import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { CheckIn } from '../../entities/checkin.entity';
import { Location } from '../../entities/location.entity';
import { CheckinStatsDaily, CheckinStatsResponse, CheckinStatsSummary } from 'libs';
import { format, parseISO } from 'date-fns';

@Injectable()
export class CheckinStatsService {
  constructor(
    @InjectRepository(CheckIn)
    private readonly checkinsRepo: Repository<CheckIn>,
    @InjectRepository(Location)
    private readonly locationsRepo: Repository<Location>,
  ) {}

  private async fetchAndProcessData(startDateStr: string, endDateStr: string, currentUserId: string, currentUserRole: string, locationId?: string): Promise<CheckinStatsResponse> {
    let locations: Location[] = [];
    
    if (locationId) {
      const loc = await this.locationsRepo.findOne({
        where: { id: locationId },
        relations: { admin: true, users: true },
      });
      if (!loc) throw new NotFoundException('Location not found');
      locations = [loc];
    } else {
      locations = await this.locationsRepo.find({
        relations: { admin: true, users: true },
      });
    }

    if (currentUserRole !== 'admin') {
      locations = locations.filter(loc => 
        loc.admin?.id === currentUserId || loc.users?.some((u) => u.id === currentUserId)
      );
      if (locations.length === 0) {
        return { summary: [], detailed: [] };
      }
    }

    const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
    const endDate = new Date(`${endDateStr}T23:59:59.999Z`);

    const whereClause: any = {
      checkedInAt: Between(startDate, endDate),
    };
    if (locationId) {
      whereClause.locationId = locationId;
    } else if (currentUserRole !== 'admin') {
      // only get checkins for locations they have access to
      whereClause.locationId = { $in: locations.map(l => l.id) }; // This is TypeORM so we should use In() but let's just use array
    }

    const checkinsQuery = this.checkinsRepo.createQueryBuilder('checkin')
      .leftJoinAndSelect('checkin.user', 'user')
      .where('checkin.checkedInAt BETWEEN :startDate AND :endDate', { startDate, endDate });

    if (locationId) {
      checkinsQuery.andWhere('checkin.locationId = :locationId', { locationId });
    } else if (currentUserRole !== 'admin' && locations.length > 0) {
      checkinsQuery.andWhere('checkin.locationId IN (:...locationIds)', { locationIds: locations.map(l => l.id) });
    }

    const checkins = await checkinsQuery.orderBy('checkin.checkedInAt', 'ASC').getMany();

    // Determine relevant users: admin sees all, member sees only themselves
    const relevantUsers = new Map<string, { name: string, email: string }>();
    if (currentUserRole === 'admin') {
      locations.forEach(loc => {
        if (loc.admin) relevantUsers.set(loc.admin.id, { name: loc.admin.name, email: loc.admin.email });
        loc.users?.forEach(u => relevantUsers.set(u.id, { name: u.name, email: u.email }));
      });
    } else {
      locations.forEach(loc => {
        if (loc.admin?.id === currentUserId) {
          relevantUsers.set(loc.admin.id, { name: loc.admin.name, email: loc.admin.email });
          loc.users?.forEach(u => relevantUsers.set(u.id, { name: u.name, email: u.email }));
        } else {
          const u = loc.users?.find(u => u.id === currentUserId);
          if (u) relevantUsers.set(u.id, { name: u.name, email: u.email });
        }
      });
    }

    // Include users from checkins just in case
    for (const c of checkins) {
      if (!relevantUsers.has(c.userId) && c.user) {
         if (currentUserRole === 'admin' || c.userId === currentUserId || locations.some(l => l.admin?.id === currentUserId && l.id === c.locationId)) {
            relevantUsers.set(c.userId, { name: c.user.name, email: c.user.email });
         }
      }
    }

    const groupedByDateAndUser: Record<string, Record<string, CheckIn[]>> = {};

    // Generate date range keys
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      groupedByDateAndUser[dateStr] = {};
      for (const userId of relevantUsers.keys()) {
        groupedByDateAndUser[dateStr][userId] = [];
      }
    }

    for (const c of checkins) {
      if (!relevantUsers.has(c.userId)) continue;
      const dateStr = format(new Date(c.checkedInAt), 'yyyy-MM-dd');
      if (!groupedByDateAndUser[dateStr]) {
        groupedByDateAndUser[dateStr] = {};
      }
      if (!groupedByDateAndUser[dateStr][c.userId]) {
        groupedByDateAndUser[dateStr][c.userId] = [];
      }
      groupedByDateAndUser[dateStr][c.userId].push(c);
    }

    const detailed: CheckinStatsDaily[] = [];
    const summaryMap = new Map<string, CheckinStatsSummary>();

    for (const [userId, user] of relevantUsers.entries()) {
      summaryMap.set(userId, {
        userId,
        userName: user.name,
        userEmail: user.email,
        totalWorkingDays: 0,
        totalWorkingHours: 0,
        lateCount: 0,
        fraudCount: 0,
        missingDataCount: 0,
      });
    }

    for (const dateStr of Object.keys(groupedByDateAndUser).sort()) {
      for (const [userId, userCheckins] of Object.entries(groupedByDateAndUser[dateStr])) {
        const summary = summaryMap.get(userId)!;
        
        if (userCheckins.length === 0) continue;

        let firstIn: CheckIn = userCheckins[0];
        let lastOut: CheckIn = userCheckins[userCheckins.length - 1];

        // Find the actual IN/OUT if available, else use absolute earliest/latest
        const explicitIn = userCheckins.find(c => c.direction === 'in');
        if (explicitIn) firstIn = explicitIn;

        const explicitOut = [...userCheckins].reverse().find(c => c.direction === 'out');
        if (explicitOut) lastOut = explicitOut;

        let workingHours = 0;
        let missingData = false;
        
        if (userCheckins.length === 1) {
          missingData = true;
          summary.missingDataCount += 1;
        } else {
           const durationMs = lastOut.checkedInAt.getTime() - firstIn.checkedInAt.getTime();
           workingHours = Number((durationMs / (1000 * 60 * 60)).toFixed(2));
           // Allow 0 working hours if checked in/out at the exact same minute
        }

        const isLate = userCheckins.some(c => c.status === 'late');
        const isFraud = userCheckins.some(c => c.status === 'fraud');

        if (isLate) summary.lateCount += 1;
        if (isFraud) summary.fraudCount += 1;

        summary.totalWorkingDays += 1;
        summary.totalWorkingHours += workingHours;

        let dailyStatus: 'success' | 'late' | 'missing_data' | 'fraud' = 'success';
        if (isFraud) dailyStatus = 'fraud';
        else if (missingData) dailyStatus = 'missing_data';
        else if (isLate) dailyStatus = 'late';

        detailed.push({
          userId,
          userName: relevantUsers.get(userId)?.name || 'Unknown',
          userEmail: relevantUsers.get(userId)?.email || 'Unknown',
          date: dateStr,
          firstIn: firstIn.checkedInAt.toISOString(),
          lastOut: userCheckins.length > 1 ? lastOut.checkedInAt.toISOString() : null,
          workingHours,
          status: dailyStatus,
        });
      }
    }

    return {
      summary: Array.from(summaryMap.values()),
      detailed: detailed.sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName)),
    };
  }

  async getSummaryStats(startDate: string, endDate: string, currentUserId: string, currentUserRole: string, locationId?: string): Promise<CheckinStatsResponse> {
    return this.fetchAndProcessData(startDate, endDate, currentUserId, currentUserRole, locationId);
  }

  async exportExcel(startDate: string, endDate: string, currentUserId: string, currentUserRole: string, locationId?: string): Promise<Buffer> {
    const data = await this.fetchAndProcessData(startDate, endDate, currentUserId, currentUserRole, locationId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IoT Check-in System';
    workbook.created = new Date();

    // Sheet 1: Summary
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Tên nhân viên', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Tổng số ngày đi làm', key: 'days', width: 20 },
      { header: 'Tổng số giờ làm', key: 'hours', width: 20 },
      { header: 'Số lần đi muộn', key: 'late', width: 15 },
      { header: 'Số lần quên Check-out', key: 'missing', width: 22 },
      { header: 'Cảnh báo gian lận', key: 'fraud', width: 20 },
    ];

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    summarySheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

    for (const sum of data.summary) {
      summarySheet.addRow({
        name: sum.userName,
        email: sum.userEmail,
        days: sum.totalWorkingDays,
        hours: sum.totalWorkingHours,
        late: sum.lateCount,
        missing: sum.missingDataCount,
        fraud: sum.fraudCount,
      });
    }

    // Sheet 2: Detailed
    const detailedSheet = workbook.addWorksheet('Detailed');
    detailedSheet.columns = [
      { header: 'Ngày', key: 'date', width: 15 },
      { header: 'Tên nhân viên', key: 'name', width: 25 },
      { header: 'Giờ vào (First In)', key: 'in', width: 20 },
      { header: 'Giờ ra (Last Out)', key: 'out', width: 20 },
      { header: 'Số giờ làm', key: 'hours', width: 15 },
      { header: 'Trạng thái', key: 'status', width: 20 },
    ];

    detailedSheet.getRow(1).font = { bold: true };
    detailedSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9BBB59' } };
    detailedSheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

    for (const row of data.detailed) {
      let statusStr = 'Hợp lệ';
      if (row.status === 'fraud') statusStr = 'Gian lận';
      else if (row.status === 'missing_data') statusStr = 'Thiếu dữ liệu';
      else if (row.status === 'late') statusStr = 'Đi muộn';

      detailedSheet.addRow({
        date: row.date,
        name: row.userName,
        in: format(new Date(row.firstIn!), 'HH:mm:ss'),
        out: row.lastOut ? format(new Date(row.lastOut), 'HH:mm:ss') : '-',
        hours: row.workingHours,
        status: statusStr,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
