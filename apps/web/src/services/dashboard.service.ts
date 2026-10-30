import type {
  CompanyPermitStatsDTO,
  PermitDashboardStatsDTO,
  PermitFilters,
  PermitFieldKey,
} from '@wms/shared';
import { getTodayYmd, PERMIT_FIELD_LIST, PTW_TYPES } from '@wms/shared';
import type { SessionUser } from '@wms/shared';
import type { PipelineStage } from 'mongoose';
import { ymdToUtcDate } from '@wms/shared';
import { connectDb } from '@/lib/db/mongoose';
import { buildPermitWorkbook } from '@/lib/excel/workbook-builder';
import { badRequest } from '@/lib/http/errors';
import { toPermitDTO } from '@/lib/mappers';
import { escapeRegex } from '@/lib/utils/object-id';
import { timestampForFileName, sanitizeFileName } from '@/lib/utils/file-name';
import { FileRecordModel } from '@/models/FileRecord';
import { PermitModel } from '@/models/Permit';

export type CompanyExportStatus = 'all' | 'active' | 'closed' | 'overdue';

interface CompanyAggregateRow {
  _id: { main: string; sub: string };
  mainContractor: string;
  subContractor: string;
  total: number;
  active: number;
  closed: number;
  overdue: number;
}

function uniquePermitPipeline(): PipelineStage[] {
  return [
    {
      $addFields: {
        _dashboardCompanyKey: {
          $toLower: { $trim: { input: { $ifNull: ['$company', ''] } } },
        },
        _dashboardSubContractorKey: {
          $toLower: { $trim: { input: { $ifNull: ['$subContractor', ''] } } },
        },
        _dashboardPtwKey: {
          $toLower: { $trim: { input: { $ifNull: ['$newPtwNumber', ''] } } },
        },
      },
    },
    {
      $addFields: {
        _dashboardPermitKey: {
          $cond: [
            { $ne: ['$_dashboardPtwKey', ''] },
            { $concat: ['$_dashboardCompanyKey', '|', '$_dashboardPtwKey'] },
            { $concat: ['record:', { $toString: '$_id' }] },
          ],
        },
      },
    },
    { $sort: { updatedAt: -1, _id: -1 } },
    {
      $group: {
        _id: '$_dashboardPermitKey',
        permit: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$permit' } },
    {
      $addFields: {
        _dashboardStatus: {
          $switch: {
            branches: [
              { case: { $eq: ['$status', 'Closed'] }, then: 'Closed' },
              {
                case: {
                  $and: [
                    { $eq: [{ $type: '$planValidEndDate' }, 'date'] },
                    { $lt: ['$planValidEndDate', ymdToUtcDate(getTodayYmd())] },
                  ],
                },
                then: 'Overdue',
              },
            ],
            default: 'Active',
          },
        },
      },
    },
  ];
}

function dashboardPermitMatch(filters: PermitFilters): PipelineStage.Match {
  const match: Record<string, unknown> = {};
  if (filters.company) {
    match._dashboardCompanyKey = filters.company.trim().toLowerCase();
  }
  if (filters.subContractor) {
    match._dashboardSubContractorKey = filters.subContractor.trim().toLowerCase();
  }
  if (filters.ptwType) match.newPtwType = filters.ptwType;
  if (filters.status)
    match._dashboardStatus = filters.status === 'Not Closed' ? 'Active' : filters.status;
  if (filters.department) match.department = filters.department;
  if (filters.discipline) match.discipline = filters.discipline;
  if (filters.plantDivision) match.plantDivision = filters.plantDivision;
  if (filters.fieldKey && filters.fieldValue) {
    const field = PERMIT_FIELD_LIST.find((item) => item.key === filters.fieldKey);
    if (field?.type === 'date') {
      const start = ymdToUtcDate(filters.fieldValue);
      match[filters.fieldKey] = {
        $gte: start,
        $lt: new Date(start.getTime() + 86_400_000),
      };
    } else if (field && field.type !== 'computed') {
      match[filters.fieldKey] = new RegExp(escapeRegex(filters.fieldValue), 'i');
    }
  }
  if (filters.dateFrom || filters.dateTo) {
    match.closedDate = {
      ...(filters.dateFrom ? { $gte: ymdToUtcDate(filters.dateFrom) } : {}),
      ...(filters.dateTo
        ? { $lte: new Date(ymdToUtcDate(filters.dateTo).getTime() + 86_400_000 - 1) }
        : {}),
    };
  }
  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), 'i');
    match.$or = [
      'company',
      'subContractor',
      'workActivity',
      'previousPtwNumber',
      'newPtwNumber',
      'workLocation',
      'equipmentTagNo',
      'approvedByPtwc',
    ].map((field) => ({ [field]: regex }));
  }
  return { $match: match };
}

export async function getPermitDashboardStats(
  filters: PermitFilters,
): Promise<PermitDashboardStatsDTO> {
  await connectDb();

  const rows = await PermitModel.aggregate<CompanyAggregateRow>([
    ...uniquePermitPipeline(),
    dashboardPermitMatch(filters),
    {
      $project: {
        mainContractor: { $trim: { input: { $ifNull: ['$company', ''] } } },
        mainContractorKey: {
          $toLower: { $trim: { input: { $ifNull: ['$company', ''] } } },
        },
        subContractor: { $trim: { input: { $ifNull: ['$subContractor', ''] } } },
        subContractorKey: {
          $toLower: { $trim: { input: { $ifNull: ['$subContractor', ''] } } },
        },
        status: '$_dashboardStatus',
      },
    },
    {
      $group: {
        _id: { main: '$mainContractorKey', sub: '$subContractorKey' },
        mainContractor: { $first: '$mainContractor' },
        subContractor: { $first: '$subContractor' },
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
        closed: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] } },
      },
    },
    { $sort: { total: -1, '_id.main': 1, '_id.sub': 1 } },
  ]);

  const byContractor: CompanyPermitStatsDTO[] = rows.map((row) => ({
    mainContractor: row.mainContractor || 'Unspecified',
    subContractor: row.subContractor || 'Unspecified',
    total: row.total,
    active: row.active,
    closed: row.closed,
    overdue: row.overdue,
  }));
  const totals = byContractor.reduce(
    (result, contractor) => ({
      total: result.total + contractor.total,
      active: result.active + contractor.active,
      closed: result.closed + contractor.closed,
      overdue: result.overdue + contractor.overdue,
    }),
    { total: 0, active: 0, closed: 0, overdue: 0 },
  );

  return {
    ...totals,
    mainContractors: new Set(
      byContractor
        .map((contractor) => contractor.mainContractor)
        .filter((value) => value !== 'Unspecified'),
    ).size,
    subContractors: new Set(
      byContractor
        .map((contractor) => contractor.subContractor)
        .filter((value) => value !== 'Unspecified'),
    ).size,
    byContractor,
  };
}

export async function exportCompanyPermits(
  filters: PermitFilters,
  exportStatus: CompanyExportStatus,
  mainContractor: string,
  subContractor: string,
  fieldKeys: readonly PermitFieldKey[],
  ptwTypes: readonly string[],
  user: SessionUser,
): Promise<{ buffer: Buffer; fileName: string; rowCount: number }> {
  await connectDb();

  const match = dashboardPermitMatch({ ...filters, status: '', ptwType: '' });
  const conditions: Record<string, unknown>[] = [match.$match];
  conditions.push({
    _dashboardCompanyKey:
      mainContractor === 'Unspecified' ? '' : mainContractor.trim().toLowerCase(),
    _dashboardSubContractorKey:
      subContractor === 'Unspecified' ? '' : subContractor.trim().toLowerCase(),
  });
  if (exportStatus !== 'all') conditions.push({ _dashboardStatus: exportStatus });
  conditions.push({ newPtwType: { $in: [...ptwTypes] } });
  const docs = await PermitModel.aggregate([
    ...uniquePermitPipeline(),
    { $match: { $and: conditions } },
    {
      $unset: [
        '_dashboardCompanyKey',
        '_dashboardSubContractorKey',
        '_dashboardPtwKey',
        '_dashboardPermitKey',
        '_dashboardStatus',
      ],
    },
    { $sort: { srNo: 1 } },
  ]);
  const permits = docs.map(toPermitDTO);
  if (permits.length === 0) throw badRequest('No permits found for the selected filters');
  const buffer = await buildPermitWorkbook(permits, fieldKeys);
  const fileName = `PTW-${sanitizeFileName(mainContractor)}-${sanitizeFileName(subContractor)}-${exportStatus}_${timestampForFileName()}.xlsx`;

  await FileRecordModel.create({
    kind: 'export',
    originalName: fileName,
    bytes: buffer.length,
    rowCount: permits.length,
    createdBy: user.id,
  });

  return { buffer, fileName, rowCount: permits.length };
}
