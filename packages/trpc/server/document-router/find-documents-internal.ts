import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import type { GetStatsInput } from '@documenso/lib/server-only/document/get-stats';
import { getStats } from '@documenso/lib/server-only/document/get-stats';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { mapEnvelopesToDocumentMany } from '@documenso/lib/utils/document';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindDocumentsInternalRequestSchema,
  ZFindDocumentsInternalResponseSchema,
} from './find-documents-internal.types';
import type { TFindDocumentsInternalResponse } from './find-documents-internal.types';

export const findDocumentsInternalRoute = authenticatedProcedure
  .input(ZFindDocumentsInternalRequestSchema)
  .output(ZFindDocumentsInternalResponseSchema)
  .query(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const {
      query,
      templateId,
      page,
      perPage,
      orderByDirection,
      orderByColumn,
      source,
      status,
      hasExpiredRecipients,
      period,
      senderIds,
      folderId,
    } = input;

    const getStatOptions: GetStatsInput = {
      user,
      period,
      search: query,
      folderId,
    };

    if (teamId) {
      const team = await getTeamById({ userId: user.id, teamId });

      const isOrganisationOwner = team.organisation.ownerUserId === user.id;
      const isTeamMember = team.teamGroups.length > 0;

      // Organisation owners who are not members of the team should not see team documents.
      if (isOrganisationOwner && !isTeamMember) {
        const emptyStats: TFindDocumentsInternalResponse['stats'] = {
          [ExtendedDocumentStatus.DRAFT]: 0,
          [ExtendedDocumentStatus.PENDING]: 0,
          [ExtendedDocumentStatus.COMPLETED]: 0,
          [ExtendedDocumentStatus.REJECTED]: 0,
          [ExtendedDocumentStatus.INBOX]: 0,
          [ExtendedDocumentStatus.ALL]: 0,
        };

        const currentPage = input.page ?? 1;
        const perPageValue = input.perPage ?? 10;

        return {
          data: [],
          count: 0,
          currentPage,
          perPage: perPageValue,
          totalPages: 0,
          stats: emptyStats,
        };
      }

      getStatOptions.team = {
        teamId: team.id,
        teamEmail: team.teamEmail?.email,
        senderIds,
        currentTeamMemberRole: team.currentTeamRole,
        currentUserEmail: user.email,
        userId: user.id,
      };
    }

    const [stats, documents] = await Promise.all([
      getStats(getStatOptions),
      findDocuments({
        userId: user.id,
        teamId,
        query,
        templateId,
        page,
        perPage,
        source,
        status,
        period,
        senderIds,
        folderId,
        hasExpiredRecipients,
        orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
      }),
    ]);

    return {
      ...documents,
      data: documents.data.map((envelope) => mapEnvelopesToDocumentMany(envelope)),
      stats,
    };
  });
