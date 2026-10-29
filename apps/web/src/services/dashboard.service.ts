import type { CompanyPermitStatsDTO, PermitDashboardStatsDTO } from '@wms/shared';
import type { SessionUser } from '@wms/shared';
import type { PipelineStage } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { buildPermitWorkbook } from '@/lib/excel/workbook-builder';
import { badRequest } from '@/lib/http/errors';
import { toPermitDTO } from '@/lib/mappers';
import { timestampForFileName, sanitizeFileName } from '@/lib/utils/file-name';
import { FileRecordModel } from '@/models/FileRecord';
import { PermitModel } from '@/models/Permit';

export type CompanyExportStatus = 'all' | 'active' | 'closed';

interface CompanyAggregateRow {
  _id: string;
  company: string;
  total: number;
  active: number;
  closed: number;
}

function uniquePermitPipeline(): PipelineStage[] {
  return [
    {
      $addFields: {
        _dashboardCompanyKey: {
          $toLower: { $trim: { input: { $ifNull: ['$company', ''] } } },
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
  ];
}

export async function getPermitDashboardStats(): Promise<PermitDashboardStatsDTO> {
  await connectDb();

  const rows = await PermitModel.aggregate<CompanyAggregateRow>([
    ...uniquePermitPipeline(),
    {
      $project: {
        company: { $trim: { input: { $ifNull: ['$company', ''] } } },
        companyKey: {
          $toLower: { $trim: { input: { $ifNull: ['$company', ''] } } },
        },
        status: 1,
      },
    },
    {
      $group: {
        _id: { $cond: [{ $eq: ['$companyKey', ''] }, 'unspecified', '$companyKey'] },
        company: { $first: '$company' },
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $ne: ['$status', 'Closed'] }, 1, 0] } },
        closed: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } },
      },
    },
    { $sort: { total: -1, _id: 1 } },
  ]);

  const byCompany: CompanyPermitStatsDTO[] = rows.map((row) => ({
    company: row._id === 'unspecified' ? 'Unspecified' : row.company,
    total: row.total,
    active: row.active,
    closed: row.closed,
  }));
  const totals = byCompany.reduce(
    (result, company) => ({
      total: result.total + company.total,
      active: result.active + company.active,
      closed: result.closed + company.closed,
    }),
    { total: 0, active: 0, closed: 0 },
  );

  return {
    ...totals,
    companies: byCompany.filter((company) => company.company !== 'Unspecified').length,
    byCompany,
  };
}

export async function exportCompanyPermits(
  companyName: string,
  status: CompanyExportStatus,
  user: SessionUser,
): Promise<{ buffer: Buffer; fileName: string; rowCount: number }> {
  await connectDb();

  const company = companyName.trim().toLowerCase();
  const match: PipelineStage.Match = {
    $match: {
      _dashboardCompanyKey: company,
      ...(status === 'closed'
        ? { status: 'Closed' }
        : status === 'active'
          ? { status: { $ne: 'Closed' } }
          : {}),
    },
  };
  const docs = await PermitModel.aggregate([
    ...uniquePermitPipeline(),
    match,
    { $unset: ['_dashboardCompanyKey', '_dashboardPtwKey', '_dashboardPermitKey'] },
    { $sort: { srNo: 1 } },
  ]);
  const permits = docs.map(toPermitDTO);
  if (permits.length === 0) throw badRequest('No permits found for this company and status');
  const buffer = await buildPermitWorkbook(permits);
  const fileName = `PTW-${sanitizeFileName(companyName)}-${status}_${timestampForFileName()}.xlsx`;

  await FileRecordModel.create({
    kind: 'export',
    originalName: fileName,
    bytes: buffer.length,
    rowCount: permits.length,
    createdBy: user.id,
  });

  return { buffer, fileName, rowCount: permits.length };
}
