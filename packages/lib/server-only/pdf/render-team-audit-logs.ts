import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { Team } from '@prisma/client';
import Konva from 'konva';
import 'konva/skia-backend';
import type { DateTimeFormatOptions } from 'luxon';
import { DateTime } from 'luxon';
import fs from 'node:fs';
import path from 'node:path';
import type { Canvas } from 'skia-canvas';
import { FontLibrary } from 'skia-canvas';
import { Image as SkiaImage } from 'skia-canvas';
import { UAParser } from 'ua-parser-js';

import { APP_I18N_OPTIONS } from '../../constants/i18n';
import { TEAM_AUDIT_LOG_TYPE } from '../../types/team-audit-logs';
import type { TTeamAuditLog } from '../../types/team-audit-logs';
import { formatTeamAuditLogAction } from '../../utils/team-audit-logs';

export type TeamAuditLogTeam = Team & {
  organisation: {
    name: string;
  } | null;
};

type GenerateTeamAuditLogsOptions = {
  team: TeamAuditLogTeam;
  auditLogs: TTeamAuditLog[];
  hidePoweredBy: boolean;
  pageWidth: number;
  pageHeight: number;
  i18n: I18n;
};

const parser = new UAParser();

const textMutedForegroundLight = '#929DAE';
const textForeground = '#000';
const textMutedForeground = '#64748B';
const textSm = 9;
const textXs = 8;
const fontMedium = '500';

const pageTopMargin = 60;
const pageBottomMargin = 15;
const contentMaxWidth = 768;
const rowPadding = 10;
const titleFontSize = 18;

type RenderVerticalLabelAndTextOptions = {
  label: string;
  text: string;
  width?: number;
  align?: 'left' | 'right';
  x?: number;
  y?: number;
  textFontFamily?: string;
};

const renderVerticalLabelAndText = (options: RenderVerticalLabelAndTextOptions) => {
  const { label, text, width, align, x, y, textFontFamily } = options;

  const group = new Konva.Group({
    x: x ?? 0,
    y: y ?? 0,
  });

  const konvaLabel = new Konva.Text({
    align: align ?? 'left',
    fontFamily: 'Inter',
    width,
    text: label,
    fontSize: textXs,
    fill: textMutedForegroundLight,
  });

  group.add(konvaLabel);

  const konvaText = new Konva.Text({
    y: group.getClientRect().height + 6,
    align: align ?? 'left',
    fontFamily: textFontFamily ?? 'Inter',
    width,
    text,
    fontSize: textXs,
    fill: textForeground,
  });

  group.add(konvaText);

  return group;
};

type RenderTeamOverviewCardOptions = {
  team: TeamAuditLogTeam;
  width: number;
  i18n: I18n;
};

const renderTeamOverviewCard = (options: RenderTeamOverviewCardOptions) => {
  const { team, width, i18n } = options;
  const cardPadding = 16;

  const overviewCard = new Konva.Group();

  const columnSpacing = 10;
  const columnWidth = (width - columnSpacing) / 2;
  const rowVerticalSpacing = 24;

  const rowOne = new Konva.Group({
    x: cardPadding,
    y: cardPadding,
  });

  const teamNameLabel = renderVerticalLabelAndText({
    label: i18n._(msg`Team`).toUpperCase(),
    text: team.name,
    width: columnWidth,
  });

  const organisationNameLabel = renderVerticalLabelAndText({
    label: i18n._(msg`Organisation`).toUpperCase(),
    text: team.organisation?.name ?? i18n._(msg`N/A`),
    width: columnWidth,
    x: columnWidth + columnSpacing,
  });

  rowOne.add(teamNameLabel);
  rowOne.add(organisationNameLabel);
  overviewCard.add(rowOne);

  const rowTwo = new Konva.Group({
    x: cardPadding,
    y: overviewCard.getClientRect().height + rowVerticalSpacing,
  });

  const createdAtLabel = renderVerticalLabelAndText({
    label: i18n._(msg`Created At`).toUpperCase(),
    text: DateTime.fromJSDate(team.createdAt)
      .setLocale(APP_I18N_OPTIONS.defaultLocale)
      .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)'),
    width: columnWidth,
  });

  rowTwo.add(createdAtLabel);
  overviewCard.add(rowTwo);

  const cardRect = new Konva.Rect({
    x: 0,
    y: 0,
    width,
    height: overviewCard.getClientRect().height + cardPadding * 2,
    stroke: '#e5e7eb',
    strokeWidth: 1.5,
    cornerRadius: 8,
  });

  overviewCard.add(cardRect);

  return overviewCard;
};

type RenderRowOptions = {
  auditLog: TTeamAuditLog;
  width: number;
  i18n: I18n;
};

const renderRow = (options: RenderRowOptions) => {
  const { auditLog, width, i18n } = options;

  const paddingWithinCard = 12;

  const columnSpacing = 10;
  const columnWidth = (width - paddingWithinCard * 2 - columnSpacing) / 2;

  const indicatorWidth = 3;
  const indicatorPaddingRight = 10;
  const rowGroup = new Konva.Group();

  const rowHeaderGroup = new Konva.Group();

  const auditLogIndicatorColor = new Konva.Circle({
    x: indicatorWidth,
    y: indicatorWidth + 3,
    radius: indicatorWidth,
    fill: getTeamAuditLogIndicatorColor(auditLog.type),
  });

  const auditLogTypeText = new Konva.Text({
    x: indicatorWidth + indicatorPaddingRight,
    y: 0,
    width: columnWidth - indicatorWidth - indicatorPaddingRight,
    text: auditLog.type.replace(/_/g, ' '),
    fontFamily: 'Inter',
    fontSize: textSm,
    fontStyle: fontMedium,
    fill: textMutedForeground,
  });

  const auditLogDescriptionText = new Konva.Text({
    x: indicatorWidth + indicatorPaddingRight,
    y: auditLogTypeText.height() + 4,
    width: columnWidth - indicatorWidth - indicatorPaddingRight,
    text: formatTeamAuditLogAction(i18n, auditLog).description,
    fontFamily: 'Inter',
    fontSize: textSm,
    fill: textForeground,
  });

  const auditLogTimestampText = new Konva.Text({
    x: columnWidth + columnSpacing,
    width: columnWidth,
    text: DateTime.fromJSDate(auditLog.createdAt)
      .setLocale(APP_I18N_OPTIONS.defaultLocale)
      .toLocaleString(dateFormat),
    fontFamily: 'Inter',
    align: 'right',
    fontSize: textSm,
    fill: textMutedForeground,
  });

  rowHeaderGroup.add(auditLogIndicatorColor);
  rowHeaderGroup.add(auditLogTypeText);
  rowHeaderGroup.add(auditLogDescriptionText);
  rowHeaderGroup.add(auditLogTimestampText);

  rowHeaderGroup.setAttrs({
    x: paddingWithinCard,
    y: paddingWithinCard,
  } satisfies Partial<Konva.GroupConfig>);

  rowGroup.add(rowHeaderGroup);

  const borderLine = new Konva.Line({
    points: [0, 0, width - paddingWithinCard * 2, 0],
    stroke: '#e5e7eb',
    strokeWidth: 1,
    x: paddingWithinCard,
    y: rowGroup.getClientRect().height + paddingWithinCard + 12,
  });

  rowGroup.add(borderLine);

  const bottomSection = new Konva.Group({
    x: paddingWithinCard,
    y: rowGroup.getClientRect().height + paddingWithinCard + 12,
  });

  const userLabel = renderVerticalLabelAndText({
    label: i18n._(msg`User`).toUpperCase(),
    text: auditLog.email || 'N/A',
    align: 'left',
    width: columnWidth,
    textFontFamily: 'ui-monospace',
  });

  const ipAddressLabel = renderVerticalLabelAndText({
    label: i18n._(msg`IP Address`).toUpperCase(),
    text: auditLog.ipAddress || 'N/A',
    align: 'right',
    x: columnWidth + columnSpacing,
    width: columnWidth,
    textFontFamily: 'ui-monospace',
  });

  bottomSection.add(userLabel);
  bottomSection.add(ipAddressLabel);

  parser.setUA(auditLog.userAgent || '');
  const userAgentInfo = parser.getResult();

  const userAgentLabel = renderVerticalLabelAndText({
    label: i18n._(msg`User Agent`).toUpperCase(),
    text: formatUserAgent(auditLog.userAgent, userAgentInfo),
    align: 'left',
    width,
    y: bottomSection.getClientRect().height + 16,
  });

  bottomSection.add(userAgentLabel);
  rowGroup.add(bottomSection);

  const cardRect = new Konva.Rect({
    x: 0,
    y: 0,
    width: rowGroup.getClientRect().width,
    height: rowGroup.getClientRect().height + paddingWithinCard * 2,
    stroke: '#e5e7eb',
    strokeWidth: 1,
    cornerRadius: 8,
  });

  rowGroup.add(cardRect);

  return rowGroup;
};

const renderBranding = () => {
  const branding = new Konva.Group();

  const brandingHeight = 16;

  const logoPath = path.join(process.cwd(), 'public/static/logo.png');
  const logo = fs.readFileSync(logoPath);

  const img = new SkiaImage(logo) as unknown as HTMLImageElement;

  const brandingImage = new Konva.Image({
    image: img,
    height: brandingHeight,
    width: brandingHeight * (img.width / img.height),
  });

  branding.add(brandingImage);
  return branding;
};

type GroupRowsIntoPagesOptions = {
  auditLogs: TTeamAuditLog[];
  maxHeight: number;
  contentWidth: number;
  i18n: I18n;
  overviewCard: Konva.Group;
};

const groupRowsIntoPages = (options: GroupRowsIntoPagesOptions) => {
  const { auditLogs, maxHeight, contentWidth, i18n, overviewCard } = options;

  const groupedRows: Konva.Group[][] = [[]];

  const overviewCardHeight = overviewCard.getClientRect().height;

  let availableHeight = maxHeight - pageTopMargin - overviewCardHeight;
  let currentGroupedRowIndex = 0;

  for (const auditLog of auditLogs) {
    const row = renderRow({ auditLog, width: contentWidth, i18n });

    const rowHeight = row.getClientRect().height;
    const requiredHeight = rowHeight + rowPadding;

    if (requiredHeight > availableHeight) {
      currentGroupedRowIndex++;
      groupedRows[currentGroupedRowIndex] = [row];

      availableHeight = maxHeight - pageTopMargin;
    } else {
      groupedRows[currentGroupedRowIndex].push(row);
    }

    availableHeight -= requiredHeight;
  }

  return groupedRows;
};

type RenderPagesOptions = {
  groupedRows: Konva.Group[][];
  margin: number;
  pageTopMargin: number;
  i18n: I18n;
  overviewCard: Konva.Group;
};

const renderPages = (options: RenderPagesOptions) => {
  const { groupedRows, margin, pageTopMargin, i18n, overviewCard } = options;

  const pages: Konva.Group[] = [];

  for (const [pageIndex, rows] of groupedRows.entries()) {
    const pageGroup = new Konva.Group();

    const pageTitle = new Konva.Text({
      x: margin,
      y: 0,
      height: pageTopMargin,
      verticalAlign: 'middle',
      text: i18n._(msg`Team Audit Log`),
      fill: textForeground,
      fontFamily: 'Inter',
      fontSize: titleFontSize,
      fontStyle: '700',
    });
    pageGroup.add(pageTitle);

    if (pageIndex === 0) {
      overviewCard.setAttrs({
        x: margin,
        y: pageGroup.getClientRect().height,
      });
      pageGroup.add(overviewCard);
    }

    for (const row of rows) {
      const yPosition = pageGroup.getClientRect().height + rowPadding;

      row.setAttrs({
        x: margin,
        y: yPosition,
      });

      pageGroup.add(row);
    }

    pages.push(pageGroup);
  }

  return pages;
};

export async function renderTeamAuditLogs({
  team,
  auditLogs,
  pageWidth,
  pageHeight,
  i18n,
  hidePoweredBy,
}: GenerateTeamAuditLogsOptions) {
  const fontPath = path.join(process.cwd(), 'public/fonts');

  FontLibrary.use({
    ['Caveat']: [path.join(fontPath, 'caveat.ttf')],
    ['Inter']: [path.join(fontPath, 'inter-variablefont_opsz,wght.ttf')],
  });

  const minimumMargin = 10;

  const contentWidth = Math.min(pageWidth - minimumMargin * 2, contentMaxWidth);
  const margin = (pageWidth - contentWidth) / 2;

  let stage: Konva.Stage | null = new Konva.Stage({ width: pageWidth, height: pageHeight });

  const overviewCard = renderTeamOverviewCard({
    team,
    width: contentWidth,
    i18n,
  });

  const groupedRows = groupRowsIntoPages({
    auditLogs,
    maxHeight: pageHeight,
    contentWidth,
    i18n,
    overviewCard,
  });

  const pageGroups = renderPages({
    groupedRows,
    margin,
    pageTopMargin,
    i18n,
    overviewCard,
  });

  const brandingGroup = renderBranding();
  const brandingRect = brandingGroup.getClientRect();
  const brandingTopPadding = 24;

  const pages: Uint8Array[] = [];

  let isBrandingPlaced = false;

  for (const [index, pageGroup] of pageGroups.entries()) {
    stage.destroyChildren();
    const page = new Konva.Layer();

    page.add(pageGroup);

    if (index === pageGroups.length - 1 && !hidePoweredBy) {
      const remainingHeight = pageHeight - pageGroup.getClientRect().height - pageBottomMargin;

      if (brandingRect.height + brandingTopPadding <= remainingHeight) {
        brandingGroup.setAttrs({
          x: pageWidth - brandingRect.width - margin,
          y: pageGroup.getClientRect().height + brandingTopPadding,
        } satisfies Partial<Konva.GroupConfig>);

        page.add(brandingGroup);
        isBrandingPlaced = true;
      }
    }

    stage.add(page);

    const canvas = page.canvas._canvas as unknown as Canvas;
    const buffer = await canvas.toBuffer('pdf');
    pages.push(new Uint8Array(buffer));
  }

  if (!hidePoweredBy && !isBrandingPlaced) {
    stage.destroyChildren();
    const page = new Konva.Layer();

    brandingGroup.setAttrs({
      x: pageWidth - brandingRect.width - margin,
      y: pageTopMargin,
    } satisfies Partial<Konva.GroupConfig>);

    page.add(brandingGroup);
    stage.add(page);

    const canvas = page.canvas._canvas as unknown as Canvas;
    const buffer = await canvas.toBuffer('pdf');

    pages.push(new Uint8Array(buffer));
  }

  stage.destroy();
  stage = null;

  return pages;
}

const dateFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_SHORT,
  hourCycle: 'h12',
};

const getTeamAuditLogIndicatorColor = (type: string) => {
  switch (type) {
    case TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_ADDED:
    case TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_JOINED_VIA_ORG_INVITE:
      return '#22c55e';
    case TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_REMOVED:
    case TEAM_AUDIT_LOG_TYPE.ORGANISATION_MEMBER_INVITE_DECLINED:
      return '#ef4444';
    default:
      return '#f1f5f9';
  }
};

const formatUserAgent = (userAgent: string | null | undefined, userAgentInfo: UAParser.IResult) => {
  if (!userAgent) {
    return 'N/A';
  }

  const browser = userAgentInfo.browser.name;
  const version = userAgentInfo.browser.version;
  const os = userAgentInfo.os.name;

  if (browser && os) {
    const browserInfo = version ? `${browser} ${version}` : browser;

    return `${browserInfo} on ${os}`;
  }

  return userAgent;
};

