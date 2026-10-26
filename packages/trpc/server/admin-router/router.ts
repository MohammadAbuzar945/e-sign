import { router } from '../trpc';
import { adminSearchRoute } from './admin-search';
import { cancelResellerApplicationRoute } from './cancel-reseller-application';
import { checkResellerAffiliateSlugRoute } from './check-reseller-affiliate-slug';
import { clearResellerDelinquencyRoute } from './clear-reseller-delinquency';
import { completePendingResellerTransactionRoute } from './complete-pending-reseller-transaction';
import { createAdminOrganisationRoute } from './create-admin-organisation';
import { createStripeCustomerRoute } from './create-stripe-customer';
import { createSubscriptionClaimRoute } from './create-subscription-claim';
import { createUserRoute } from './create-user';
import { deactivateResellerProfileRoute } from './deactivate-reseller-profile';
import { deleteDocumentRoute } from './delete-document';
import { deleteOrganisationRoute } from './delete-organisation';
import { deleteAdminOrganisationMemberRoute } from './delete-organisation-member';
import { deleteRecipientRoute } from './delete-recipient';
import { deleteResellerRoute } from './delete-reseller';
import { deleteSubscriptionClaimRoute } from './delete-subscription-claim';
import { deleteAdminTeamMemberRoute } from './delete-team-member';
import { deleteUserRoute } from './delete-user';
import { disableUserRoute } from './disable-user';
import { downloadDocumentAuditLogsRoute } from './download-document-audit-logs';
import { createEmailTransportRoute } from './email-transport/create-email-transport';
import { deleteEmailTransportRoute } from './email-transport/delete-email-transport';
import { findEmailTransportsRoute } from './email-transport/find-email-transports';
import { sendTestEmailTransportRoute } from './email-transport/send-test-email-transport';
import { updateEmailTransportRoute } from './email-transport/update-email-transport';
import { enableUserRoute } from './enable-user';
import { exportResellerTransactionsRoute } from './export-reseller-transactions';
import { findAdminOrganisationsRoute } from './find-admin-organisations';
import { findDocumentAuditLogsRoute } from './find-document-audit-logs';
import { findDocumentJobsRoute } from './find-document-jobs';
import { findDocumentsRoute } from './find-documents';
import { findEmailDomainsRoute } from './find-email-domains';
import { findOrganisationStatsRoute } from './find-organisation-stats';
import { findPaystackWebhookEventsRoute } from './find-paystack-webhook-events';
import { findSubscriptionClaimsRoute } from './find-subscription-claims';
import { findUnsealedDocumentsRoute } from './find-unsealed-documents';
import { findUserTeamsRoute } from './find-user-teams';
import { getAdminOrganisationRoute } from './get-admin-organisation';
import { getAdminOrganisationPendingInvitesRoute } from './get-admin-organisation-pending-invites';
import { getAdminTeamRoute } from './get-admin-team';
import { getEmailDomainRoute } from './get-email-domain';
import { getPaystackWebhookEventRoute } from './get-paystack-webhook-event';
import { getResellerApplicationRoute } from './get-reseller-application';
import { getResellerTermsTemplateVariablesRoute } from './get-reseller-terms-template-variables';
import { getUserRoute } from './get-user';
import { markResellerDelinquentRoute } from './mark-reseller-delinquent';
import {
  getNomiaPricePlansRoute,
  updateNomiaPricePlansRoute,
} from './nomia-pricing';
import {
  getResellerNotifyRecipientsRoute,
  notifyResellersRoute,
  previewResellerNotifyRoute,
} from './notify-resellers';
import { promoteMemberToOwnerRoute } from './promote-member-to-owner';
import { reactivateResellerProfileRoute } from './reactivate-reseller-profile';
import { reregisterEmailDomainRoute } from './reregister-email-domain';
import { resealDocumentRoute } from './reseal-document';
import { resetOrganisationMonthlyStatRoute } from './reset-organisation-monthly-stat';
import { resetTwoFactorRoute } from './reset-two-factor-authentication';
import { resyncLicenseRoute } from './resync-license';
import {
  findResellerApplicationsRoute,
  rejectResellerApplicationRoute,
  retryResellerApplicationActivationRoute,
  sendResellerTermsRoute,
} from './reseller-applications';
import {
  findResellerBulkPurchasesRoute,
  exportResellerBulkPurchasesRoute,
  getResellerBulkRatesRoute,
  listGlobalResellerBulkRatesRoute,
  replaceGlobalResellerBulkRatesRoute,
  replaceResellerBulkRatesRoute,
} from './reseller-bulk-rates';
import {
  getAffiliateResellerRoute,
  initializeResellerPurchaseRoute,
} from './reseller-purchase';
import {
  getEffectiveResellerBulkRatesRoute,
  initializeResellerBulkPurchaseRoute,
} from './reseller-bulk-purchase';
import {
  associateOrganisationWithResellerRoute,
  clearOrganisationResellerAssociationRoute,
  getOrganisationBillingAttributionRoute,
  initializeAttributedPaygPurchaseRoute,
  resolveOrganisationPaygBillingRoute,
  setOrganisationStickyBillingOptInRoute,
} from './reseller-attribution';
import {
  listPaystackBanksRoute,
  refreshResellerSubaccountStatusRoute,
  resolvePaystackBankAccountRoute,
  updateResellerBankDetailsRoute,
  updateResellerPayoutModeRoute,
} from './reseller-payout';
import {
  findResellerTransactionsRoute,
  getResellerProfileRoute,
  updateResellerPackagesRoute,
  updateResellerProfileRoute,
} from './reseller-profile';
import { sendAdminOrganisationInviteRemindersRoute } from './send-admin-organisation-invite-reminders';
import { swapOrganisationSubscriptionRoute } from './swap-organisation-subscription';
import { syncOrganisationSubscriptionRoute } from './sync-organisation-subscription';
import { updateAdminOrganisationRoute } from './update-admin-organisation';
import { updateAdminOrganisationCreditsRoute } from './update-admin-organisation-credits';
import { updateOrganisationMemberRoleRoute } from './update-organisation-member-role';
import { updateResellerAffiliateSlugRoute } from './update-reseller-affiliate-slug';
import { updateResellerAllowNegativeCreditsRoute } from './update-reseller-allow-negative-credits';
import { updateRecipientRoute } from './update-recipient';
import { updateSiteSettingRoute } from './update-site-setting';
import { updateSubscriptionClaimRoute } from './update-subscription-claim';
import { updateUserRoute } from './update-user';
import {
  refreshResellerBankAccountStatusRoute,
  retryResellerSubaccountRoute,
} from './verify-reseller-bank-account';

export const adminRouter = router({
  organisation: {
    find: findAdminOrganisationsRoute,
    get: getAdminOrganisationRoute,
    create: createAdminOrganisationRoute,
    update: updateAdminOrganisationRoute,
    updateCredits: updateAdminOrganisationCreditsRoute,
    delete: deleteOrganisationRoute,
    subscription: {
      swap: swapOrganisationSubscriptionRoute,
      sync: syncOrganisationSubscriptionRoute,
    },
    stats: {
      find: findOrganisationStatsRoute,
      reset: resetOrganisationMonthlyStatRoute,
    },
  },
  organisationMember: {
    promoteToOwner: promoteMemberToOwnerRoute,
    updateRole: updateOrganisationMemberRoleRoute,
    delete: deleteAdminOrganisationMemberRoute,
  },
  organisationMemberInvite: {
    getPending: getAdminOrganisationPendingInvitesRoute,
    sendReminders: sendAdminOrganisationInviteRemindersRoute,
  },
  claims: {
    find: findSubscriptionClaimsRoute,
    create: createSubscriptionClaimRoute,
    update: updateSubscriptionClaimRoute,
    delete: deleteSubscriptionClaimRoute,
  },
  resellerApplications: {
    find: findResellerApplicationsRoute,
    get: getResellerApplicationRoute,
    getTermsTemplateVariables: getResellerTermsTemplateVariablesRoute,
    sendTerms: sendResellerTermsRoute,
    reject: rejectResellerApplicationRoute,
    cancel: cancelResellerApplicationRoute,
    retryActivation: retryResellerApplicationActivationRoute,
    deactivate: deactivateResellerProfileRoute,
    reactivate: reactivateResellerProfileRoute,
    markDelinquent: markResellerDelinquentRoute,
    clearDelinquency: clearResellerDelinquencyRoute,
    updateAllowNegativeCredits: updateResellerAllowNegativeCreditsRoute,
    refreshBankAccountStatus: refreshResellerBankAccountStatusRoute,
    retrySubaccount: retryResellerSubaccountRoute,
    delete: deleteResellerRoute,
    getNotifyRecipients: getResellerNotifyRecipientsRoute,
    previewNotify: previewResellerNotifyRoute,
    notify: notifyResellersRoute,
    checkAffiliateSlug: checkResellerAffiliateSlugRoute,
    updateAffiliateSlug: updateResellerAffiliateSlugRoute,
    getProfile: getResellerProfileRoute,
    updateProfile: updateResellerProfileRoute,
    updatePackages: updateResellerPackagesRoute,
    findTransactions: findResellerTransactionsRoute,
    exportTransactions: exportResellerTransactionsRoute,
    completePendingTransaction: completePendingResellerTransactionRoute,
    updatePayoutMode: updateResellerPayoutModeRoute,
    updateBankDetails: updateResellerBankDetailsRoute,
    listBanks: listPaystackBanksRoute,
    resolveBankAccount: resolvePaystackBankAccountRoute,
    refreshSubaccountStatus: refreshResellerSubaccountStatusRoute,
    getAffiliate: getAffiliateResellerRoute,
    initializePurchase: initializeResellerPurchaseRoute,
    getBillingAttribution: getOrganisationBillingAttributionRoute,
    resolvePaygBilling: resolveOrganisationPaygBillingRoute,
    associateReseller: associateOrganisationWithResellerRoute,
    clearResellerAssociation: clearOrganisationResellerAssociationRoute,
    setStickyBillingOptIn: setOrganisationStickyBillingOptInRoute,
    initializeAttributedPayg: initializeAttributedPaygPurchaseRoute,
    getEffectiveBulkRates: getEffectiveResellerBulkRatesRoute,
    initializeBulkPurchase: initializeResellerBulkPurchaseRoute,
  },
  resellerBulkRates: {
    listGlobal: listGlobalResellerBulkRatesRoute,
    replaceGlobal: replaceGlobalResellerBulkRatesRoute,
    getForReseller: getResellerBulkRatesRoute,
    replaceForReseller: replaceResellerBulkRatesRoute,
    findPurchases: findResellerBulkPurchasesRoute,
    exportPurchases: exportResellerBulkPurchasesRoute,
  },
  nomiaPricing: {
    getMany: getNomiaPricePlansRoute,
    updateMany: updateNomiaPricePlansRoute,
  },
  stripe: {
    createCustomer: createStripeCustomerRoute,
  },
  license: {
    resync: resyncLicenseRoute,
  },
  user: {
    get: getUserRoute,
    create: createUserRoute,
    update: updateUserRoute,
    delete: deleteUserRoute,
    enable: enableUserRoute,
    disable: disableUserRoute,
    resetTwoFactor: resetTwoFactorRoute,
    findTeams: findUserTeamsRoute,
  },
  document: {
    find: findDocumentsRoute,
    findUnsealed: findUnsealedDocumentsRoute,
    delete: deleteDocumentRoute,
    reseal: resealDocumentRoute,
    findJobs: findDocumentJobsRoute,
    findAuditLogs: findDocumentAuditLogsRoute,
    downloadAuditLogs: downloadDocumentAuditLogsRoute,
  },
  paystackWebhooks: {
    find: findPaystackWebhookEventsRoute,
    get: getPaystackWebhookEventRoute,
  },
  recipient: {
    update: updateRecipientRoute,
    delete: deleteRecipientRoute,
  },
  emailDomain: {
    find: findEmailDomainsRoute,
    get: getEmailDomainRoute,
    reregister: reregisterEmailDomainRoute,
  },
  emailTransport: {
    find: findEmailTransportsRoute,
    create: createEmailTransportRoute,
    update: updateEmailTransportRoute,
    delete: deleteEmailTransportRoute,
    sendTest: sendTestEmailTransportRoute,
  },
  team: {
    get: getAdminTeamRoute,
  },
  teamMember: {
    delete: deleteAdminTeamMemberRoute,
  },
  search: adminSearchRoute,
  updateSiteSetting: updateSiteSettingRoute,
});
