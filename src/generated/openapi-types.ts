export type SendPayloadValue = string | number | boolean | null | SendPayloadValue[] | {
    [key: string]: SendPayloadValue;
};
export interface paths {
    "/v1/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listWebhooks"];
        put?: never;
        post: operations["createWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/{webhookId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getWebhook"];
        put?: never;
        post?: never;
        delete: operations["deleteWebhook"];
        options?: never;
        head?: never;
        patch: operations["updateWebhook"];
        trace?: never;
    };
    "/v1/webhooks/{webhookId}/rotate-secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["rotateWebhookSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/{webhookId}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listWebhookEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/{webhookId}/events/{eventId}/attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listWebhookAttempts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/{webhookId}/events/{eventId}/replay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["replayWebhookEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/{webhookId}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["testWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listEmails"];
        put?: never;
        post: operations["generateEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/{emailId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getEmail"];
        put?: never;
        post?: never;
        delete: operations["deleteEmail"];
        options?: never;
        head?: never;
        patch: operations["editEmail"];
        trace?: never;
    };
    "/v1/emails/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["importEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/figma": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["importFigmaDesign"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/image": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["importEmailImage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/{emailId}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["cloneEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/{emailId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["restoreEmailVersion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/{emailId}/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["exportEmailDesign"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["auditEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/{emailId}/client-previews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["previewEmailAcrossClients"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/{emailId}/inbox-placement-tests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listInboxPlacementTests"];
        put?: never;
        post: operations["createInboxPlacementTest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/{emailId}/inbox-placement-tests/{testId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getInboxPlacementTest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/audits/{auditId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getEmailAudit"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/client-previews/{previewId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getEmailRendering"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/canvas/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["createCanvasSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/canvas/sessions/{sessionId}/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["refreshCanvasSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/canvas/sessions/{sessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["revokeCanvasSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/email-groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listEmailGroups"];
        put?: never;
        post: operations["createEmailGroup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/email-groups/{groupId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getEmailGroup"];
        put?: never;
        post?: never;
        delete: operations["deleteEmailGroup"];
        options?: never;
        head?: never;
        patch: operations["updateEmailGroup"];
        trace?: never;
    };
    "/v1/sends": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listSends"];
        put?: never;
        post: operations["createSend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/sends/{sendId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getSend"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/sends/{sendId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["cancelSend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/sends/{sendId}/pause": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["pauseSend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/sends/{sendId}/resume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["resumeSend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/analytics/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getAnalyticsOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/analytics/automations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getAutomationAnalytics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/analytics/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getEventsAnalytics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listAutomations"];
        put?: never;
        post: operations["createAutomation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/{automationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getAutomation"];
        put?: never;
        post?: never;
        delete: operations["deleteAutomation"];
        options?: never;
        head?: never;
        patch: operations["updateAutomation"];
        trace?: never;
    };
    "/v1/automations/{automationId}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["testAutomation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/{automationId}/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["runAutomation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/audience-runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listAudienceRuns"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/audience-runs/{audienceRunId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getAudienceRun"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/audience-runs/{audienceRunId}/pause": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["pauseAudienceRun"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/audience-runs/{audienceRunId}/resume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["resumeAudienceRun"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/audience-runs/{audienceRunId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["cancelAudienceRun"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listAutomationRuns"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/runs/{automationRunId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getAutomationRun"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/runs/{automationRunId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["cancelAutomationRun"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/triggers/brew-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ensureBrewEventTrigger"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/triggers/integration-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ensureIntegrationEventTrigger"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/triggers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listTriggers"];
        put?: never;
        post: operations["createTrigger"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/triggers/{triggerEventId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getTrigger"];
        put?: never;
        post?: never;
        delete: operations["deleteTrigger"];
        options?: never;
        head?: never;
        patch: operations["updateTrigger"];
        trace?: never;
    };
    "/v1/automations/triggers/{triggerEventId}/readiness": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["checkTriggerReady"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/triggers/{triggerEventId}/fire": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["fireTrigger"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/triggers/{triggerEventId}/contract": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getTriggerContract"];
        put: operations["setTriggerContract"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/triggers/{triggerEventId}/contract/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["validateTriggerPayload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/payload-contracts/infer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["inferPayloadContract"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/trigger-instances": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listTriggerInstances"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/automations/trigger-instances/{triggerInstanceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getTriggerInstance"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listContacts"];
        put?: never;
        post: operations["upsertContacts"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contacts/{email}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getContact"];
        put?: never;
        post?: never;
        delete: operations["deleteContact"];
        options?: never;
        head?: never;
        patch: operations["updateContact"];
        trace?: never;
    };
    "/v1/contacts/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["searchContacts"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contacts/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["validateContacts"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contacts/import-csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["importContactsCsv"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contacts/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["importContacts"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contacts/batch-delete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["batchDeleteContacts"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/fields": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listContactFields"];
        put?: never;
        post: operations["createContactField"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/fields/{fieldName}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getContactField"];
        put?: never;
        post?: never;
        delete: operations["deleteContactField"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/audiences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listAudiences"];
        put?: never;
        post: operations["createAudience"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/audiences/{audienceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getAudience"];
        put?: never;
        post?: never;
        delete: operations["deleteAudience"];
        options?: never;
        head?: never;
        patch: operations["updateAudience"];
        trace?: never;
    };
    "/v1/audiences/from-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["createAudienceFromEvents"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/audiences/{audienceId}/duplicate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["duplicateAudience"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/domains": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listDomains"];
        put?: never;
        post: operations["addDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/domains/{domainId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getDomain"];
        put?: never;
        post?: never;
        delete: operations["deleteDomain"];
        options?: never;
        head?: never;
        patch: operations["updateDomain"];
        trace?: never;
    };
    "/v1/domains/{domainId}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["verifyDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/domains/{domainId}/unsubscribes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listDomainUnsubscribes"];
        put?: never;
        post: operations["addDomainUnsubscribes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/domains/{domainId}/unsubscribes/{email}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["removeDomainUnsubscribe"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/domains/{domainId}/unsubscribes/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["importDomainUnsubscribes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/domains/{domainId}/unsubscribes/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["exportDomainUnsubscribes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/domains/{domainId}/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getDomainHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listTemplates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/templates/{templateId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getTemplate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/flows": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listFlows"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/flows/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getFlow"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/brand": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getBrand"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["updateBrand"];
        trace?: never;
    };
    "/v1/brand/images": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getBrandImages"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/brand/images/{assetId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["deleteBrandImage"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/brands": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listBrands"];
        put?: never;
        post: operations["createBrand"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/brands/{brandId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getBrandById"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/content/generate-image": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["generateImage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/content/gif": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["createGif"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/content/transform": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["transformImage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/content/html-to-png": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["htmlToPng"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/content/add-image": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["addImage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/content/image-uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["createImageUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/usage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getUsage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/integrations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listIntegrations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/integrations/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listIntegrationEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/integrations/events/{eventId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["describeIntegrationEvent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/api-keys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listApiKeys"];
        put?: never;
        post: operations["createApiKey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/api-keys/{keyId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["revokeApiKey"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/help": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getHelp"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/chats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listChats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/chats/{chatId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getChatContext"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/insights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listInsights"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/insights/{insightId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getInsight"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listNotifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/emails/{emailId}/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listEmailComments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        EmailWebhookEvent: {
            type: "email.sent";
            created_at: string;
            data: {
                email_id: string;
                created_at: string;
                from?: string;
                to: string[];
                subject?: string;
                tags?: {
                    [key: string]: string;
                };
                brew: {
                    event_id: string;
                    schema_version: 1;
                    recipient?: string;
                    send_id?: string;
                    design_id?: string;
                    automation_id?: string;
                    provider_message_id?: string;
                    test?: true;
                };
            };
        } | {
            type: "email.delivered";
            created_at: string;
            data: {
                email_id: string;
                created_at: string;
                from?: string;
                to: string[];
                subject?: string;
                tags?: {
                    [key: string]: string;
                };
                brew: {
                    event_id: string;
                    schema_version: 1;
                    recipient?: string;
                    send_id?: string;
                    design_id?: string;
                    automation_id?: string;
                    provider_message_id?: string;
                    test?: true;
                };
            };
        } | {
            type: "email.delivery_delayed";
            created_at: string;
            data: {
                email_id: string;
                created_at: string;
                from?: string;
                to: string[];
                subject?: string;
                tags?: {
                    [key: string]: string;
                };
                brew: {
                    event_id: string;
                    schema_version: 1;
                    recipient?: string;
                    send_id?: string;
                    design_id?: string;
                    automation_id?: string;
                    provider_message_id?: string;
                    test?: true;
                };
            };
        } | {
            type: "email.complained";
            created_at: string;
            data: {
                email_id: string;
                created_at: string;
                from?: string;
                to: string[];
                subject?: string;
                tags?: {
                    [key: string]: string;
                };
                brew: {
                    event_id: string;
                    schema_version: 1;
                    recipient?: string;
                    send_id?: string;
                    design_id?: string;
                    automation_id?: string;
                    provider_message_id?: string;
                    test?: true;
                };
            };
        } | {
            type: "email.bounced";
            created_at: string;
            data: {
                email_id: string;
                created_at: string;
                from?: string;
                to: string[];
                subject?: string;
                tags?: {
                    [key: string]: string;
                };
                brew: {
                    event_id: string;
                    schema_version: 1;
                    recipient?: string;
                    send_id?: string;
                    design_id?: string;
                    automation_id?: string;
                    provider_message_id?: string;
                    test?: true;
                };
                bounce?: {
                    type: string;
                    subType?: string;
                    message?: string;
                    diagnosticCode?: string[];
                };
            };
        } | {
            type: "email.failed";
            created_at: string;
            data: {
                email_id: string;
                created_at: string;
                from?: string;
                to: string[];
                subject?: string;
                tags?: {
                    [key: string]: string;
                };
                brew: {
                    event_id: string;
                    schema_version: 1;
                    recipient?: string;
                    send_id?: string;
                    design_id?: string;
                    automation_id?: string;
                    provider_message_id?: string;
                    test?: true;
                };
                failed?: {
                    reason: string;
                };
            };
        } | {
            type: "email.opened";
            created_at: string;
            data: {
                email_id: string;
                created_at: string;
                from?: string;
                to: string[];
                subject?: string;
                tags?: {
                    [key: string]: string;
                };
                brew: {
                    event_id: string;
                    schema_version: 1;
                    recipient?: string;
                    send_id?: string;
                    design_id?: string;
                    automation_id?: string;
                    provider_message_id?: string;
                    test?: true;
                };
                open?: {
                    timestamp?: string;
                    ipAddress?: string;
                    userAgent?: string;
                };
            };
        } | {
            type: "email.clicked";
            created_at: string;
            data: {
                email_id: string;
                created_at: string;
                from?: string;
                to: string[];
                subject?: string;
                tags?: {
                    [key: string]: string;
                };
                brew: {
                    event_id: string;
                    schema_version: 1;
                    recipient?: string;
                    send_id?: string;
                    design_id?: string;
                    automation_id?: string;
                    provider_message_id?: string;
                    test?: true;
                };
                click?: {
                    link: string;
                    timestamp?: string;
                    ipAddress?: string;
                    userAgent?: string;
                };
            };
        };
        EmailSummary: {
            emailId: string;
            emailVersionId?: string;
            title: string;
            status: "generating" | "ready" | "failed";
            previewImage?: string;
            updatedAt: string;
            subjectLine?: string;
            previewText?: string;
            lang?: "en" | "de" | "fr" | "es" | "pt" | "it" | "nl" | "pl" | "sv" | "da" | "no" | "fi" | "cs" | "sk" | "hu" | "ro" | "bg" | "el" | "tr" | "ru" | "uk" | "hr" | "sr" | "sl" | "lt" | "lv" | "et" | "ca" | "ar" | "he" | "fa" | "ur" | "hi" | "bn" | "th" | "vi" | "id" | "ms" | "tl" | "ja" | "ko" | "zh-Hans" | "zh-Hant" | "sw" | "af";
            html?: string;
            versions?: {
                version: number | "latest";
                emailVersionId: string;
            }[];
            group: {
                groupId: string;
                groupName: string;
            } | null;
            createdBy?: string;
            createdByUserId?: string;
        };
        EmailDetail: {
            emailId: string;
            emailVersionId?: string;
            title: string;
            status: "generating" | "ready" | "failed";
            previewImage?: string;
            updatedAt: string;
            subjectLine?: string;
            previewText?: string;
            lang?: "en" | "de" | "fr" | "es" | "pt" | "it" | "nl" | "pl" | "sv" | "da" | "no" | "fi" | "cs" | "sk" | "hu" | "ro" | "bg" | "el" | "tr" | "ru" | "uk" | "hr" | "sr" | "sl" | "lt" | "lv" | "et" | "ca" | "ar" | "he" | "fa" | "ur" | "hi" | "bn" | "th" | "vi" | "id" | "ms" | "tl" | "ja" | "ko" | "zh-Hans" | "zh-Hant" | "sw" | "af";
            html?: string;
            versions?: {
                version: number | "latest";
                emailVersionId: string;
            }[];
            group: {
                groupId: string;
                groupName: string;
            } | null;
            createdBy?: string;
            createdByUserId?: string;
            version?: number | "latest";
            runId?: string;
            previewStatus: "available" | "unavailable" | "not_ready";
            content?: {
                url: string;
                mimeType: "text/html";
                bytes: number;
                expiresAt: string;
            };
            text?: string;
            textTruncated?: boolean;
            links?: {
                href: string | null;
                text: string;
                count: number;
            }[];
            linksTruncated?: boolean;
            errorMessage?: string;
            errorCause?: string;
        };
        CanvasSession: {
            sessionId: string;
            embedUrl: string;
            bootstrapToken: string;
            expiresAt: string;
            target: {
                type: "group";
                groupId: string;
            } | {
                type: "email";
                emailId: string;
            };
        };
        EmailGroupSummary: {
            groupId: string;
            groupName: string;
            emailCount: number;
            createdBy?: string;
            createdByUserId?: string;
        };
        EmailGroupWriteResponse: {
            groupId: string;
            groupName: string;
            emailCount: number;
            createdBy?: string;
            createdByUserId?: string;
            moved?: number;
            notMoved?: {
                emailId: string;
                reason: "not_found" | "generating" | "not_movable" | "folder_full" | "retry";
            }[];
        };
        Send: {
            sendId: string;
            kind: "campaign" | "automation";
            messageClass?: "marketing" | "transactional";
            automationId?: string;
            nodeId?: string;
            automationRunId?: string;
            audienceRunId?: string;
            triggerInstanceId?: string;
            emailId: string;
            emailVersionId?: string;
            status: "scheduled" | "queued" | "running" | "paused" | "completed" | "partially_completed" | "failed" | "canceled";
            approvalState?: "pending" | "approved" | "rejected";
            pauseReason?: "manual" | "plan_limit" | "domain_unsendable" | "bounce_rate";
            subject?: string;
            previewText?: string;
            from?: {
                email: string;
                name?: string;
            };
            replyTo?: string;
            domainId?: string;
            audienceId?: string;
            audienceName?: string;
            recipientCount?: number;
            scheduledAt?: string;
            startedAt?: string;
            completedAt?: string;
            failedAt?: string;
            error?: string;
            stats?: {
                sent: number;
                delivered: number;
                opened: number;
                clicked: number;
                bounced: number;
                hardBounced?: number;
                complained: number;
                unsubscribed: number;
            };
            delivery?: {
                accepted: number;
                pending: number;
                delayed: number;
                delivered: number;
                bounced: number;
                failed: number;
                providerSuppressed: number;
                preSendSkipped: number;
                renderFailed: number;
                updatedAt: string;
            };
            gradualSend?: {
                startingPercentage: number;
                incrementPercentage: number;
                interval: {
                    value: number;
                    unit: "hour";
                } | {
                    value: number;
                    unit: "day";
                };
                timeZone: string;
                rampEndsAt?: string;
                currentTranche?: number;
                sentSoFar?: number;
                pausedAt?: string;
                pauseReason?: "manual";
                resumedAt?: string;
            };
            smartSend?: {
                windowEndsAt?: string;
                assignedViaModel?: number;
                assignedImmediately?: number;
                modelFallbacks?: number;
            };
            createdAt: string;
            updatedAt: string;
            events?: {
                eventType: "sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "provider_suppressed" | "suppressed" | "quota_skipped" | "received" | "unsubscribed";
                occurredAt: string;
                recipientEmail?: string;
                url?: string;
                machineGenerated?: boolean;
                clickBotReason?: string;
            }[];
        };
        SendEvent: {
            eventType: "sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "provider_suppressed" | "suppressed" | "quota_skipped" | "received" | "unsubscribed";
            occurredAt: string;
            recipientEmail?: string;
            url?: string;
            machineGenerated?: boolean;
            clickBotReason?: string;
        };
        AutomationNode: {
            id: string;
            label: string;
            description?: string;
            type: "trigger";
            config: {
                actionType?: string;
                eventName?: string;
                mode?: "event";
                triggerEventId?: string;
            } | {
                actionType?: string;
                eventName?: string;
                mode: "manualAudience";
                audienceId: string;
            };
        } | {
            id: string;
            label: string;
            description?: string;
            type: "sendEmail";
            config: {
                actionType?: string;
                emailId: string;
                emailVersionId: string;
                domainId?: string;
                subject: string;
                previewText?: string;
                fromName?: string;
                replyTo?: string;
                emailTitle?: string;
                fromAddress?: string;
            };
        } | {
            id: string;
            label: string;
            description?: string;
            type: "wait";
            config: {
                actionType?: string;
                duration: number;
                unit: "ms" | "seconds" | "minutes" | "hours" | "days" | "weeks";
            };
        } | {
            id: string;
            label: string;
            description?: string;
            type: "filter";
            config: {
                actionType?: string;
                mode?: "payload";
                logicalOperator: "AND" | "OR";
                conditions: ({
                    field: string;
                    type: "string";
                    operator: "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "ends_with";
                    value: string;
                } | {
                    field: string;
                    type: "number";
                    operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                    value: number;
                } | {
                    field: string;
                    type: "date";
                    operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                    value: string | number;
                } | {
                    field: string;
                    type: "string";
                    operator: "in" | "not_in" | "contains_any" | "not_contains_any";
                    value: string[];
                } | {
                    field: string;
                    type: "number";
                    operator: "in" | "not_in";
                    value: number[];
                } | {
                    field: string;
                    type: "number";
                    operator: "between";
                    value: [
                        number,
                        number
                    ];
                } | {
                    field: string;
                    type: "date";
                    operator: "between";
                    value: [
                        string | number,
                        string | number
                    ];
                } | {
                    field: string;
                    type: "string";
                    operator: "is_empty" | "is_not_empty";
                } | {
                    field: string;
                    type: "number";
                    operator: "is_empty" | "is_not_empty";
                } | {
                    field: string;
                    type: "date";
                    operator: "is_empty" | "is_not_empty";
                } | {
                    field: string;
                    type: "bool";
                    operator: "is_true" | "is_false";
                })[];
            } | {
                actionType?: string;
                mode: "engagement";
                sourceNodeId: string;
                window: {
                    duration: number;
                    unit: "ms" | "seconds" | "minutes" | "hours" | "days" | "weeks";
                };
                branches: {
                    id: string;
                    label?: string;
                    condition: {
                        kind: "engaged" | "not_engaged" | "clicked_link";
                        events?: "opened" | "clicked" | "opened_or_clicked";
                        url?: string;
                        position?: "any" | "first" | "last";
                    };
                }[];
            };
        } | {
            id: string;
            label: string;
            description?: string;
            type: "split";
            config: {
                actionType?: string;
                mode: "percentage";
                leftLabel: string;
                rightLabel: string;
                leftPercentage: number;
                seed?: string;
            } | {
                actionType?: string;
                mode: "condition";
                leftLabel: string;
                rightLabel: string;
                logicalOperator: "AND" | "OR";
                conditions: ({
                    field: string;
                    type: "string";
                    operator: "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "ends_with";
                    value: string;
                } | {
                    field: string;
                    type: "number";
                    operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                    value: number;
                } | {
                    field: string;
                    type: "date";
                    operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                    value: string | number;
                } | {
                    field: string;
                    type: "string";
                    operator: "in" | "not_in" | "contains_any" | "not_contains_any";
                    value: string[];
                } | {
                    field: string;
                    type: "number";
                    operator: "in" | "not_in";
                    value: number[];
                } | {
                    field: string;
                    type: "number";
                    operator: "between";
                    value: [
                        number,
                        number
                    ];
                } | {
                    field: string;
                    type: "date";
                    operator: "between";
                    value: [
                        string | number,
                        string | number
                    ];
                } | {
                    field: string;
                    type: "string";
                    operator: "is_empty" | "is_not_empty";
                } | {
                    field: string;
                    type: "number";
                    operator: "is_empty" | "is_not_empty";
                } | {
                    field: string;
                    type: "date";
                    operator: "is_empty" | "is_not_empty";
                } | {
                    field: string;
                    type: "bool";
                    operator: "is_true" | "is_false";
                })[];
            };
        };
        AutomationConnection: {
            from: string;
            to: string;
            branch?: string;
        };
        AutomationRow: {
            automationId: string;
            automationVersionId: string;
            triggerEventId?: string;
            name: string;
            description?: string;
            version: number | "latest";
            published: boolean;
            isLive?: boolean;
            liveVersion?: number | "latest";
            liveAutomationVersionId?: string;
            warnings?: components["schemas"]["ApiWarning"][];
            paused?: boolean;
            pausedAt?: number;
            nodes?: ({
                id: string;
                label: string;
                description?: string;
                type: "trigger";
                config: {
                    actionType?: string;
                    eventName?: string;
                    mode?: "event";
                    triggerEventId?: string;
                } | {
                    actionType?: string;
                    eventName?: string;
                    mode: "manualAudience";
                    audienceId: string;
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "sendEmail";
                config: {
                    actionType?: string;
                    emailId?: string;
                    emailVersionId?: string;
                    emailTitle?: string;
                    subject?: string;
                    previewText?: string;
                    fromName?: string;
                    fromAddress?: string;
                    domainId?: string;
                    replyTo?: string;
                    to?: unknown;
                    html?: string;
                    variables?: {
                        [key: string]: unknown;
                    };
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "wait";
                config: {
                    actionType?: string;
                    duration: number;
                    unit: "ms" | "seconds" | "minutes" | "hours" | "days" | "weeks";
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "filter";
                config: {
                    actionType?: string;
                    mode?: "payload";
                    logicalOperator: "AND" | "OR";
                    conditions: {
                        field: string;
                        operator: string;
                        value?: string | number | boolean | (string | number)[];
                        type?: "string" | "number" | "date" | "bool";
                    }[];
                } | {
                    actionType?: string;
                    mode: "engagement";
                    sourceNodeId: string;
                    window: {
                        duration: number;
                        unit: "ms" | "seconds" | "minutes" | "hours" | "days" | "weeks";
                    };
                    branches: {
                        id: string;
                        label?: string;
                        condition: {
                            kind: "engaged" | "not_engaged" | "clicked_link";
                            events?: "opened" | "clicked" | "opened_or_clicked";
                            url?: string;
                            position?: "any" | "first" | "last";
                        };
                    }[];
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "split";
                config: {
                    actionType?: string;
                    mode: "percentage";
                    leftLabel: string;
                    rightLabel: string;
                    leftPercentage: number;
                    seed?: string;
                } | {
                    actionType?: string;
                    mode: "condition";
                    leftLabel: string;
                    rightLabel: string;
                    logicalOperator: "AND" | "OR";
                    conditions: {
                        field: string;
                        operator: string;
                        value?: string | number | boolean | (string | number)[];
                        type?: "string" | "number" | "date" | "bool";
                    }[];
                };
            })[];
            connections?: {
                from: string;
                to: string;
                branch?: string;
            }[];
            emailIds: string[];
            createdBy?: string;
            createdByUserId?: string;
            publishedBy?: string;
            publishedByUserId?: string;
            createdAt?: string;
            updatedAt?: string;
            publishedAt?: string;
            versions?: {
                version: number | "latest";
                automationVersionId: string;
            }[];
        };
        ApiWarning: {
            code: "DRAFT_SAVED_NOT_LIVE" | "NODE_ID_REPLACED" | "TRIGGER_EVENT_NOT_RECEIVED" | "ENFORCEMENT_LOOSENED_WHILE_PUBLISHED" | "REQUIRED_FIELD_SATISFIED_BY_FALLBACK" | "RESUBSCRIBE_SKIPPED" | "CORE_FIELD_IGNORED" | "BLANK_FIELD_NAME_IGNORED" | "DATE_ORDER_ASSUMED" | "FIELD_TYPE_COERCED" | "CSV_ROW_SKIPPED" | "CONTACT_EXISTS_SKIPPED" | "CSV_COLUMN_IGNORED" | "CSV_COLUMN_MATCHED_FIELD" | "VALIDATION_SKIPPED" | "RECIPIENTS_EXCLUDED" | "CONSENT_RECORD_MISSING";
            message: string;
            field?: string;
        };
        AutomationDryRunReport: {
            valid: boolean;
            blockers: {
                nodeId?: string;
                nodeLabel?: string;
                severity: "error" | "warning";
                message: string;
            }[];
            warnings: {
                nodeId?: string;
                nodeLabel?: string;
                severity: "error" | "warning";
                message: string;
            }[];
            blockingIssues?: {
                nodeId: string;
                nodeLabel: string;
                surface: "triggerBinding" | "subject" | "previewText" | "fromName" | "replyTo" | "emailBody" | "filterCondition" | "splitCondition";
                variable: string;
                reason: string;
                fatal: boolean;
                hasFallback: boolean;
            }[];
            nodeCounts: {
                sendEmail: number;
                wait: number;
                filter: number;
                split: number;
            };
        };
        AudienceRun: {
            audienceRunId: string;
            automationId: string;
            automationName?: string;
            audienceId: string;
            audienceName?: string;
            status: "queued" | "scheduled" | "running" | "paused" | "completed" | "failed" | "canceled";
            approvalState?: "pending" | "approved" | "rejected";
            pauseReason?: "manual" | "plan_limit";
            scheduledAt?: string;
            totalRecipients?: number;
            sentCount?: number;
            failedCount?: number;
            skippedCount?: number;
            nodeStats?: {
                nodeId: string;
                nodeType: string;
                status?: "running" | "completed" | "failed";
                entered?: number;
                sent?: number;
                failed?: number;
                skipped?: number;
                startedAt?: string;
                completedAt?: string;
                sendId?: string;
            }[];
            gradualSend?: {
                startingPercentage: number;
                incrementPercentage: number;
                interval: {
                    value: number;
                    unit: "hour";
                } | {
                    value: number;
                    unit: "day";
                };
                timeZone: string;
                rampEndsAt?: string;
                currentTranche?: number;
                sentSoFar?: number;
                pausedAt?: string;
                pauseReason?: "manual";
                resumedAt?: string;
            };
            error?: string;
            stalledAt?: string;
            resumeGeneration?: number;
            resumedAt?: string;
            startedAt?: string;
            completedAt?: string;
            createdAt: string;
            updatedAt: string;
        };
        AutomationRunRow: {
            automationRunId: string;
            automationId: string;
            automationVersionId?: string;
            definitionHash?: string;
            triggerInstanceId?: string;
            mode: "live" | "test";
            status: "queued" | "running" | "completed" | "failed" | "canceled";
            recipientEmail?: string;
            startedAt?: string;
            completedAt?: string;
            error?: string;
        };
        AutomationRunLogRow: {
            automationRunId: string;
            nodeId: string;
            nodeName: string;
            nodeType: "trigger" | "wait" | "filter" | "split" | "sendEmail";
            status: "running" | "completed" | "failed" | "skipped";
            orderIndex: number;
            branch?: string;
            durationMs?: number;
            startedAt: string;
            completedAt?: string;
            error?: string;
        };
        TriggerRow: {
            triggerEventId: string;
            title: string;
            description?: string;
            provider: "brew_api" | "custom" | "brew_event" | "clerk" | "stytch" | "supabase" | "workos" | "stripe" | "shopify" | "revenuecat" | "framer" | "posthog" | "typeform" | "webflow" | "hubspot";
            providerEventKey?: string;
            brewEvent?: {
                event: "contact.unsubscribed";
                scope: "domain" | "all";
                domainHost?: string;
            };
            payloadSchema: {
                type: "object";
                fields: components["schemas"]["TriggerPayloadField"][];
            };
            createdAt: string;
            updatedAt: string;
            skill?: string;
        };
        TriggerPayloadField: {
            key: string;
            type: "string" | "int" | "boolean" | "object" | "array";
            required: boolean;
            fallbackValue?: string | number | boolean;
            pii?: "none" | "low" | "high";
            secret?: boolean;
            children?: components["schemas"]["TriggerPayloadField"][];
            itemType?: "string" | "int" | "boolean";
        };
        TriggerInstance: {
            triggerInstanceId: string;
            source: "api" | "integration" | "brew_event";
            provider?: string;
            triggerEventId?: string;
            state: "received" | "verified" | "matched" | "partially_fired" | "fired" | "rejected" | "dead_letter";
            matchedAutomationIds: string[];
            automationRunIds: string[];
            rejectionReason?: string;
            attempts: number;
            receivedAt: string;
            processedAt?: string;
        };
        Contact: {
            email: string;
            firstName?: string;
            lastName?: string;
            subscribed?: boolean;
            consent?: {
                source: "api" | "form" | "import" | "app" | "integration";
                capturedAt: string;
                policyVersion?: string;
                evidence?: string;
            };
            validationStatus?: "valid" | "risky" | "invalid";
            suppressed?: boolean;
            suppressedReason?: string | null;
            unsubscribedDomains?: string[];
            lastValidatedAt?: string;
            validationDetails?: {
                provider: "brew";
                reason?: string;
                didYouMean?: string;
                risk?: string;
                isDisposable?: boolean;
                isRole?: boolean;
            };
            createdAt: string;
            updatedAt: string;
            importId?: string | null;
            csvFileName?: string | null;
            customFields?: {
                [key: string]: unknown;
            };
        };
        ContactFieldDefinition: {
            fieldName: string;
            fieldType: "string" | "number" | "date" | "bool";
            label?: string;
            isCore?: boolean;
            isFilterable?: boolean;
            isSortable?: boolean;
            isSearchable?: boolean;
            coverage?: {
                percent: number;
                approximate: boolean;
                topValues: {
                    value: string;
                    count: number;
                    percent: number;
                }[];
                dominantValue?: string;
            };
        };
        Audience: {
            audienceId: string;
            audienceName: string;
            filters: {
                filters: {
                    field: string;
                    operator: "equals" | "not_equals" | "contains" | "not_contains" | "contains_any" | "not_contains_any" | "starts_with" | "ends_with" | "gt" | "gte" | "lt" | "lte" | "between" | "is_true" | "is_false" | "in" | "not_in" | "is_empty" | "not_exists" | "is_not_empty" | "exists" | "is_set" | "before" | "after" | "on_date";
                    value?: unknown;
                    type?: string;
                }[];
                logicalOperator: "and" | "or";
            };
            count: number;
            materializationStatus?: "pending" | "running" | "ready" | "failed";
            createdAt: string;
            updatedAt: string;
            build?: {
                jobId: string;
                status: "queued" | "running" | "completed" | "partially_completed" | "failed";
                cohort: {
                    eventTypes: ("sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "skipped" | "unsubscribed")[];
                    from: string;
                    to: string;
                    sendId?: string;
                    emailId?: string;
                    automationIds?: string[];
                    audienceIds?: string[];
                    recipient?: string[];
                    includeMachineClicks?: boolean;
                    exclude?: {
                        baseAudienceId: string;
                    };
                };
                field: {
                    key: string;
                    label: string;
                    type: "date";
                };
                counts: {
                    eventsScanned: number;
                    stampedContacts?: number;
                };
                error?: string;
                enqueuedAt: string;
                completedAt?: string;
            };
        };
        AudienceBuild: {
            jobId: string;
            status: "queued" | "running" | "completed" | "partially_completed" | "failed";
            cohort: {
                eventTypes: ("sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "skipped" | "unsubscribed")[];
                from: string;
                to: string;
                sendId?: string;
                emailId?: string;
                automationIds?: string[];
                audienceIds?: string[];
                recipient?: string[];
                includeMachineClicks?: boolean;
                exclude?: {
                    baseAudienceId: string;
                };
            };
            field: {
                key: string;
                label: string;
                type: "date";
            };
            counts: {
                eventsScanned: number;
                stampedContacts?: number;
            };
            error?: string;
            enqueuedAt: string;
            completedAt?: string;
        };
        Domain: {
            domainId: string;
            domainUrl: string;
            name: string;
            region: string;
            status: "not_started" | "pending" | "verified" | "failed" | "temporary_failure" | "partially_verified" | "partially_failed";
            sendingEnabled: boolean;
            sendable: boolean;
            sendingPurpose: "marketing" | "transactional";
            records: {
                record: string;
                name: string;
                type: string;
                ttl: string;
                status: string;
                value: string;
                priority?: number;
            }[];
            openTracking?: boolean;
            clickTracking?: boolean;
            createdAt: string;
            updatedAt: string;
            verifiedAt?: string;
        };
        DomainUnsubscribeRow: {
            email: string;
            scope: "domain" | "all" | "both";
            unsubscribedAt?: string;
            source?: "link" | "one_click" | "api" | "import" | "manual";
            sendId?: string;
        };
        Template: {
            emailId: string;
            title: string;
            category?: string;
            brand?: string;
            html: string;
            previewImage: string;
            updatedAt: string;
        };
        Flow: {
            slug: string;
            brand: {
                name: string;
                logo?: string;
            };
            title: string;
            type: "newsletter" | "signup";
            kind?: "onboarding" | "trial" | "events" | "product_updates" | "promotions";
            category: string;
            categoryLabel: string;
            emailCount: number;
            spanDays: number;
            remixCount: number;
            previewImages: string[];
            publishedAt: string;
            updatedAt: string;
            anchor?: "submittedAt" | "signedUpAt" | "verifiedAt" | "firstEmail";
            steps?: {
                order: number;
                dayOffset: number;
                delayDays: number;
                subject: string;
                previewText?: string;
                category: string;
                categoryLabel: string;
                emailId: string;
                previewImage?: string;
                html?: string;
            }[];
        };
        FlowStep: {
            order: number;
            dayOffset: number;
            delayDays: number;
            subject: string;
            previewText?: string;
            category: string;
            categoryLabel: string;
            emailId: string;
            previewImage?: string;
            html?: string;
        };
        ChatListRow: {
            chatId: string;
            title: string | null;
            firstUserPrompt: string | null;
            lastAssistantPreview: string | null;
            status: "idle" | "streaming" | "background_finalizing" | "completed" | "failed" | "interrupted" | "stopped" | "persistence_failed" | null;
            origin: "slack" | "teams" | "google-chat" | "telegram" | null;
            updatedAt: string;
            url: string;
        };
        InsightListRow: {
            insightId: string;
            title: string;
            description: string;
            severity: "critical" | "warning" | "opportunity" | "info";
            confidence: "high" | "medium" | "low";
            kind: "answer" | "insight" | "strategy";
            category: string;
            detectorId: string;
            state: "active" | "snoozed" | "cleared" | "dismissed" | "resolved" | "stale";
            firstSeenAt: string;
            lastSeenAt: string;
            recurrenceCount: number;
            action?: {
                kind: "navigate";
                label: string;
                url: string;
            } | {
                kind: "assistant";
                label: string;
                intent: "review_domain_health" | "validate_contacts" | "create_campaign" | "repeat_campaign" | "draft_automation" | "review_recommendation";
                prompt: string;
            };
            url: string;
        };
        InsightList: {
            data: components["schemas"]["InsightListRow"][];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
            freshness: {
                dataAsOf: string | null;
                lastSuccessfulRunAt: string | null;
                latestAttempt: {
                    status: "succeeded" | "failed" | "running" | "unknown";
                    at: string;
                } | null;
            };
            pulse?: {
                windowEnd: string;
                delivered: number;
                priorDelivered: number;
                uniqueOpens: number;
                priorUniqueOpens: number;
                uniqueClicks: number;
                priorUniqueClicks: number;
                unsubscribed: number;
                priorUnsubscribed: number;
                openRatePct: number | null;
                priorOpenRatePct: number | null;
                clickRatePct: number | null;
                priorClickRatePct: number | null;
                openDirection: "up" | "down" | "steady";
                clickDirection: "up" | "down" | "steady";
                countsOnly: boolean;
                measured: boolean;
            } | null;
            report?: {
                reportId: string;
                chatId: string;
                runTrigger: "manual" | "scheduled";
                createdAt: string;
                insights: {
                    key: string;
                    kind: "performance" | "audience" | "trend" | "risk" | "content" | "setup";
                    title: string;
                    body: string;
                    impact: string | null;
                    suggestionId: string | null;
                }[];
            } | null;
            suggestions?: {
                suggestionId: string;
                title: string;
                prompt: string;
                kind: "audience" | "campaign" | "automation" | "deliverability" | "schedule";
                status: "proposed" | "launched" | "dismissed" | "concluded";
                rationale: string | null;
                sourceInsightKeys: string[];
                executionChatId: string | null;
                createdAt: string;
                updatedAt: string;
            }[];
            memo?: {
                markdown: string;
                version: number;
                updatedAt: string;
                updatedByChatId: string | null;
            } | null;
        };
        Insight: {
            insightId: string;
            title: string;
            description: string;
            severity: "critical" | "warning" | "opportunity" | "info";
            confidence: "high" | "medium" | "low";
            kind: "answer" | "insight" | "strategy";
            category: string;
            detectorId: string;
            state: "active" | "snoozed" | "cleared" | "dismissed" | "resolved" | "stale";
            firstSeenAt: string;
            lastSeenAt: string;
            recurrenceCount: number;
            action?: {
                kind: "navigate";
                label: string;
                url: string;
            } | {
                kind: "assistant";
                label: string;
                intent: "review_domain_health" | "validate_contacts" | "create_campaign" | "repeat_campaign" | "draft_automation" | "review_recommendation";
                prompt: string;
            };
            url: string;
            rationale: string | null;
            closedReason: string | null;
            closedAt: string | null;
            lastActedAt: string | null;
            churnCount: number;
            metrics: {
                [key: string]: {
                    kind: "count";
                    value: number;
                    noun: string;
                } | {
                    kind: "rate";
                    value: number | null;
                    numerator: number;
                    denominator: number;
                    basis: "delivered" | "sent" | "uniqueOpened" | "recipients";
                    anomalous?: boolean;
                } | {
                    kind: "share";
                    value: number | null;
                    part: number;
                    whole: number;
                    wholeNoun: string;
                } | {
                    kind: "duration";
                    ms: number;
                    bucketIndex?: number;
                } | {
                    kind: "delta";
                    value: number;
                    unit: "pp" | "pct" | "abs";
                    from: number;
                    to: number;
                } | {
                    kind: "hourOfDay";
                    hour: number;
                    slot?: number;
                    basis: "utc" | "brand_zone";
                    timeZone?: string;
                } | {
                    kind: "multiple";
                    value: number;
                    referenceLabel: string;
                } | {
                    kind: "rank";
                    position: number;
                    outOf: number;
                } | {
                    kind: "interval";
                    lo: number;
                    hi: number;
                    confidenceLevel: 0.9 | 0.95;
                    as: "rate" | "delta" | "count";
                } | {
                    kind: "label";
                    text: string;
                };
            };
            evidence: {
                label: string;
                url?: string;
            }[];
            subject: {
                kind: string;
                id: string;
                label: string;
            };
            method: {
                what: string;
                how: string;
                comparedAgainst: string;
                resolvesWhen: string;
                caveat?: string;
            } | null;
            generatedBy: {
                trigger: "cron_daily" | "send_settled" | "lifecycle_event" | "manual_refresh";
                startedAt: string;
                completedAt: string | null;
                blindSpots: string[];
            } | null;
            freshness: {
                dataAsOf: string | null;
                lastSuccessfulRunAt: string | null;
                latestAttempt: {
                    status: "succeeded" | "failed" | "running" | "unknown";
                    at: string;
                } | null;
            };
        };
        Notification: {
            notificationId: string;
            type: "webhook_attention" | "chat_stream" | "import_job" | "brand_image_import" | "validation_job" | "email_sent" | "email_scheduled" | "preview_email" | "brand_extracted" | "domain_status" | "domain_score_run" | "api_key_created" | "email_send_failed" | "gradual_send_paused" | "gradual_send_completed" | "send_limit_reached" | "trial_ending" | "trial_expired" | "payment_failed" | "automation_pause_window_closed" | "send_review_rejected" | "comment_mention" | "comment_reply" | "integration_attention";
            status: "uploading" | "preparing" | "processing" | "finalizing" | "streaming" | "background_finalizing" | "completed" | "partial" | "failed" | "interrupted" | "stopped" | "persistence_failed";
            title: string;
            subtitle: string;
            progressPercent?: number;
            url?: string;
            chatId?: string;
            emailId?: string;
            domainId?: string;
            domainName?: string;
            isPersonal: boolean;
            createdAt: string;
            updatedAt: string;
            completedAt?: string;
        };
        EmailCommentThread: {
            commentId: string;
            emailId: string;
            status: "open";
            target: {
                kind: "email";
            } | {
                kind: "element";
                elementId?: string;
                nodeType?: string;
            };
            participants: {
                userId: string;
                name: string;
            }[];
            participantCount: number;
            messageCount: number;
            lastMessageAt: string;
            lastMessagePreview: string;
            url: string;
            messages?: {
                messageId: string;
                author: {
                    userId: string;
                    name: string;
                };
                body: string;
                mentions: {
                    userId: string;
                    name: string;
                }[];
                createdAt: string;
                updatedAt: string;
            }[];
            messagesCursor?: string | null;
        };
        Webhook: {
            id: string;
            endpoint: string;
            events: ("email.sent" | "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained" | "email.failed" | "email.opened" | "email.clicked")[];
            description: string;
            status: "enabled" | "disabled";
            created_at: string;
        };
        ApiErrorEnvelope: {
            error: {
                code: components["schemas"]["ApiErrorCode"];
                type: "authentication_error" | "authorization_error" | "invalid_request" | "not_found" | "not_implemented" | "conflict" | "rate_limit" | "payment_required" | "service_unavailable" | "internal_error";
                message: string;
                param?: string;
                suggestion: string;
                docs: string;
                retryAfter?: number;
                details?: {
                    [key: string]: unknown;
                };
            };
        };
        ApiErrorCode: "ACCOUNT_SUSPENDED" | "API_KEY_REVOKED" | "AUDIENCE_BUILD_ACTIVE" | "AUDIENCE_BUILD_ALREADY_ACTIVE" | "AUDIENCE_EDIT_CONFLICT" | "AUDIENCE_MEMBERSHIP_NOT_EXPRESSIBLE" | "AUDIENCE_NOT_FOUND" | "AUDIENCE_RUN_NOT_FOUND" | "AUDIT_NOT_FOUND" | "AUTHENTICATION_REQUIRED" | "AUTOMATION_GRAPH_INVALID" | "AUTOMATION_IN_PROGRESS" | "AUTOMATION_NOT_FOUND" | "AUTOMATION_NOT_PAUSABLE" | "AUTOMATION_NOT_PUBLISHED" | "AUTOMATION_NOT_READY" | "AUTOMATION_NOT_RUNNABLE" | "AUTOMATION_RUN_NOT_FOUND" | "AUTOMATION_VERSION_CONFLICT" | "AUTOMATION_VERSION_NOT_FOUND" | "BATCH_TOO_LARGE" | "BRAND_DOMAIN_CONFLICT" | "BRAND_ID_REQUIRED" | "BRAND_LIMIT_REACHED" | "BRAND_NOT_FOUND" | "BRAND_NOT_READY" | "BRAND_SCOPE_MISMATCH" | "CHAT_NOT_FOUND" | "COMMENT_NOT_FOUND" | "CONSENT_REQUIRED" | "CONTACT_NOT_FOUND" | "CONTENT_OPERATION_FAILED" | "CONTRACT_LOCKED_BY_PUBLISHED_AUTOMATIONS" | "CORE_FIELD_IMMUTABLE" | "DOMAIN_ALREADY_EXISTS" | "DOMAIN_CLAIMED_ELSEWHERE" | "DOMAIN_NOT_FOUND" | "DOMAIN_NOT_READY" | "DOMAIN_OTHER_BRAND" | "DOMAIN_PROVIDER_ERROR" | "DOMAIN_PURPOSE_NOT_ALLOWED" | "DOMAIN_VERIFICATION_FAILED" | "DOMAIN_VERIFIED_ELSEWHERE" | "EMAIL_GENERATION_FAILED" | "EMAIL_GROUP_NAME_CONFLICT" | "EMAIL_GROUP_NOT_FOUND" | "EMAIL_IMAGES_MISSING" | "EMAIL_IMPORT_FAILED" | "EMAIL_IMPORT_PERSISTENCE_FAILED" | "EMAIL_IN_PROGRESS" | "EMAIL_IN_USE_BY_AUTOMATION" | "EMAIL_NOT_FOUND" | "EMAIL_NOT_READY" | "EMAIL_RESULT_UNAVAILABLE" | "EMAIL_RUN_AMBIGUOUS" | "EMAIL_TEMPLATE_INVALID" | "EMAIL_VERSION_NOT_FOUND" | "EXPORT_PROVIDER_ERROR" | "EXPORT_UNSUPPORTED" | "FIELD_NAME_AMBIGUOUS" | "FIELD_NAME_COLLISION" | "FIELD_NAME_INVALID" | "FIELD_NOT_FOUND" | "FIELD_TYPE_MISMATCH" | "FIGMA_ACCESS_DENIED" | "FIGMA_CONVERSION_FAILED" | "FIGMA_FRAME_NOT_FOUND" | "FIGMA_NOT_CONNECTED" | "FIGMA_UNAVAILABLE" | "FIGMA_URL_INVALID" | "FLOW_NOT_FOUND" | "IDEMPOTENCY_CONFLICT" | "IDEMPOTENCY_IN_PROGRESS" | "IMAGE_CONVERSION_FAILED" | "IMAGE_URL_INVALID" | "INSIGHT_NOT_FOUND" | "INSUFFICIENT_CREDITS" | "INSUFFICIENT_PERMISSIONS" | "INSUFFICIENT_ROLE" | "INTEGRATION_EVENT_NOT_FOUND" | "INTEGRATION_NOT_CONNECTED" | "INTEGRATION_RECONNECT_REQUIRED" | "INTERNAL_ERROR" | "INVALID_API_KEY" | "INVALID_EMAIL" | "INVALID_PAYLOAD" | "INVALID_REQUEST" | "LIQUID_RENDER_ERROR" | "METHOD_NOT_ALLOWED" | "MISSING_EMAIL" | "NO_ACTIVE_PLAN" | "NO_ELIGIBLE_RECIPIENTS" | "NO_PUBLISHED_AUTOMATION" | "NOT_FOUND" | "NOT_IMPLEMENTED" | "ORG_SCOPE_REQUIRED" | "PAYLOAD_SCHEMA_EMAIL_REQUIRED" | "PAYLOAD_TOO_LARGE" | "PREVIEW_NOT_FOUND" | "PUBLISH_VALIDATION_FAILED" | "RATE_LIMITED" | "RECIPIENT_UNSUBSCRIBED" | "REFERENCE_EMAIL_NOT_FOUND" | "RESUBSCRIBE_NOT_ALLOWED" | "RUN_IN_PROGRESS" | "RUN_NOT_CANCELLABLE" | "RUN_NOT_PAUSABLE" | "RUN_NOT_PAUSED" | "RUN_NOT_RESUMABLE" | "RUN_START_FAILED" | "RUN_STOP_FAILED" | "SEND_NOT_CANCELLABLE" | "SEND_NOT_FOUND" | "SEND_NOT_PAUSABLE" | "SEND_NOT_RESUMABLE" | "SEND_QUOTA_EXCEEDED" | "SERVICE_UNAVAILABLE" | "TEMPLATE_NOT_FOUND" | "TEST_RECIPIENT_NOT_ALLOWED" | "TRIGGER_ALREADY_EXISTS" | "TRIGGER_EVENT_NOT_FOUND" | "TRIGGER_HAS_DEPENDENT_AUTOMATIONS" | "TRIGGER_IMMUTABLE" | "TRIGGER_INSTANCE_NOT_FOUND" | "TRIGGER_LIMIT_REACHED" | "TRIGGER_NOT_FIREABLE" | "UPLOAD_IN_PROGRESS" | "UPLOAD_NOT_FOUND" | "UPLOAD_NOT_RECEIVED" | "WRITE_CONFLICT";
        EmailsListResponse: {
            data: {
                emailId: string;
                emailVersionId?: string;
                title: string;
                status: "generating" | "ready" | "failed";
                previewImage?: string;
                updatedAt: string;
                subjectLine?: string;
                previewText?: string;
                lang?: "en" | "de" | "fr" | "es" | "pt" | "it" | "nl" | "pl" | "sv" | "da" | "no" | "fi" | "cs" | "sk" | "hu" | "ro" | "bg" | "el" | "tr" | "ru" | "uk" | "hr" | "sr" | "sl" | "lt" | "lv" | "et" | "ca" | "ar" | "he" | "fa" | "ur" | "hi" | "bn" | "th" | "vi" | "id" | "ms" | "tl" | "ja" | "ko" | "zh-Hans" | "zh-Hant" | "sw" | "af";
                html?: string;
                versions?: {
                    version: number | "latest";
                    emailVersionId: string;
                }[];
                group: {
                    groupId: string;
                    groupName: string;
                } | null;
                createdBy?: string;
                createdByUserId?: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        EmailGenerateTextResponse: {
            response: string;
        };
        EmailGenerateGeneratedResponse: {
            emailId: string;
            emailVersionId: string;
            html: string;
            previewImage?: string;
            group: {
                groupId: string;
                groupName: string;
            } | null;
            subjectLine?: string;
            title?: string;
            saveAdjustments?: {
                kind: string;
                count: number;
                message: string;
            }[];
        };
        EmailGenerateRequest: {
            prompt: string;
            contentUrls?: string[];
            referenceEmailId?: string;
            category?: "welcome" | "onboarding" | "newsletter" | "content" | "event-invitation" | "event-reminder" | "event-recap" | "product-launch" | "product-update" | "product-pitch" | "promotional" | "cart-abandonment" | "re-engagement" | "subscription" | "feedback-request" | "referral" | "company-news" | "fundraising" | "order-confirmation" | "shipping-update" | "receipt" | "password-reset" | "verification" | "security-alert" | "account-update" | "notification" | "support" | "internal" | "business" | "general";
            title?: string;
            subjectLine?: string;
            lang?: "en" | "de" | "fr" | "es" | "pt" | "it" | "nl" | "pl" | "sv" | "da" | "no" | "fi" | "cs" | "sk" | "hu" | "ro" | "bg" | "el" | "tr" | "ru" | "uk" | "hr" | "sr" | "sl" | "lt" | "lv" | "et" | "ca" | "ar" | "he" | "fa" | "ur" | "hi" | "bn" | "th" | "vi" | "id" | "ms" | "tl" | "ja" | "ko" | "zh-Hans" | "zh-Hant" | "sw" | "af";
            groupId?: string;
            groupName?: string;
        };
        EmailImportResponse: {
            emailId: string;
            emailVersionId: string;
            html: string;
            previewImage?: string;
            group: {
                groupId: string;
                groupName: string;
            } | null;
            subjectLine?: string;
            title?: string;
            saveAdjustments?: {
                kind: string;
                count: number;
                message: string;
            }[];
            assetReport: {
                discovered: number;
                rehosted: number;
                retained: number;
                stripped: number;
                dropped?: number;
                warnings: {
                    code: "fetch_failed_retained" | "non_image_resource_retained" | "social_icon_substituted" | "tracking_pixel_dropped" | "unsafe_url_stripped" | "unsupported_resource_retained" | "upload_failed_retained" | "inline_asset_retained" | "attachment_dropped" | "embedded_reference_unresolved" | "tailwind_config_unresolved" | "tailwind_class_dropped" | "foreign_component_dropped" | "current_time_frozen" | "element_dropped" | "text_dropped";
                    location: "background" | "css-url" | "data-src" | "data-srcset" | "markup" | "module" | "preload" | "src" | "srcset" | "stylesheet" | "vml-src";
                    host?: string;
                }[];
            };
        };
        EmailImportRequest: {
            format: "html" | "mjml" | "jsx" | "eml";
            content: string;
            title?: string;
            subjectLine?: string;
            baseUrl?: string;
            groupId?: string;
            groupName?: string;
        };
        FigmaToEmailResponse: {
            emailId: string;
            emailVersionId: string;
            title: string;
            format: "jsx" | "html";
            content: string;
            warningCount: number;
            exportedNodeCount: number;
            previewImage?: string;
            group: {
                groupId: string;
                groupName: string;
            } | null;
            subjectLine?: string;
        };
        FigmaToEmailRequest: {
            hrefMap?: {
                [key: string]: string;
            };
            figmaUrl: string;
            title?: string;
            groupId?: string;
            groupName?: string;
            subjectLine?: string;
            format?: "jsx" | "html";
        };
        ImageToEmailResponse: {
            emailId: string;
            emailVersionId: string;
            title: string;
            format: "jsx" | "html";
            content: string;
            conversion: "layers" | "model";
            previewImage?: string;
            group: {
                groupId: string;
                groupName: string;
            } | null;
            subjectLine?: string;
        };
        ImageToEmailRequest: {
            imageUrl: string;
            title?: string;
            groupId?: string;
            groupName?: string;
            subjectLine?: string;
            format?: "jsx" | "html";
        };
        EmailGenerateResponse: {
            emailId: string;
            emailVersionId: string;
            html: string;
            previewImage?: string;
            group: {
                groupId: string;
                groupName: string;
            } | null;
            subjectLine?: string;
            title?: string;
            saveAdjustments?: {
                kind: string;
                count: number;
                message: string;
            }[];
        } | {
            response: string;
        };
        EmailEditRequest: {
            prompt?: string;
            emailVersionId?: string;
            contentUrls?: string[];
            title?: string;
            subjectLine?: string;
            lang?: "en" | "de" | "fr" | "es" | "pt" | "it" | "nl" | "pl" | "sv" | "da" | "no" | "fi" | "cs" | "sk" | "hu" | "ro" | "bg" | "el" | "tr" | "ru" | "uk" | "hr" | "sr" | "sl" | "lt" | "lv" | "et" | "ca" | "ar" | "he" | "fa" | "ur" | "hi" | "bn" | "th" | "vi" | "id" | "ms" | "tl" | "ja" | "ko" | "zh-Hans" | "zh-Hant" | "sw" | "af" | null;
            groupId?: string | null;
        };
        EmailsDeleteResponse: {
            emailId: string;
            deleted: boolean;
            reason?: "already_deleted" | "not_found";
            deletedAt?: string;
        };
        EmailCloneRequest: {
            emailVersionId?: string;
            title?: string;
            groupId?: string;
            groupName?: string;
        };
        EmailRestoreRequest: {
            emailVersionId: string;
        };
        EmailExportResponse: {
            emailId: string;
            provider: "braze" | "brevo" | "hubspot" | "klaviyo" | "mailchimp" | "mailjet" | "iterable" | "postmark" | "onesignal" | "mailgun" | "sendgrid" | "loops" | "campaignmonitor";
            providerName: string;
            templateName: string;
            templateId?: string;
            dryRun: boolean;
        };
        EmailExportRequest: {
            provider: "braze" | "brevo" | "hubspot" | "klaviyo" | "mailchimp" | "mailjet" | "iterable" | "postmark" | "onesignal" | "mailgun" | "sendgrid" | "loops" | "campaignmonitor";
            templateName?: string;
            senderEmail?: string;
            dryRun?: boolean;
        };
        EmailAuditResponse: {
            schemaVersion: 1;
            rulesetVersion: string;
            auditId: string;
            contentHash: string;
            auditedAt: string;
            expiresAt: string;
            policy: {
                purpose: "marketing" | "transactional" | "unknown";
                source: "provided" | "defaulted" | "trusted_adapter" | "inferred";
                confidence?: number;
                unsubscribe: "required" | "not_required" | "not_evaluated";
            };
            summary: {
                blockers: number;
                errors: number;
                warnings: number;
                info: number;
                total: number;
            };
            checks: ({
                id: string;
                status: "passed";
                durationMs: number;
                findingCount: 0;
            } | {
                id: string;
                status: "issues";
                durationMs: number;
                findingCount: number;
            } | {
                id: string;
                status: "not_applicable";
                reason: "no_remote_links" | "no_remote_images" | "no_remote_assets" | "missing_copy" | "requires_sending_domain" | "send_transport_owned" | "requires_audience_context" | "separate_deliverability_test" | "transactional_purpose" | "unknown_purpose";
            } | {
                id: string;
                status: "unavailable";
                reason: "timeout" | "upstream" | "invalid_response";
                retryable: boolean;
                durationMs: number;
            })[];
            metrics: {
                htmlBytes: number;
                linkCount: number;
                imageCount: number;
                gifCount: number;
                loadedSize: {
                    status: "exact";
                    htmlBytes: number;
                    remoteAssetBytes: number;
                    totalBytes: number;
                    assetCount: number;
                } | {
                    status: "lower_bound";
                    htmlBytes: number;
                    knownRemoteAssetBytes: number;
                    knownTotalBytes: number;
                    unknownAssetCount: number;
                };
            };
            findings: {
                id: string;
                ruleId: string;
                category: "compliance" | "links" | "images" | "accessibility" | "compatibility" | "copy" | "size" | "markup";
                severity: "blocker" | "error" | "warning" | "info";
                impact: "block" | "confirm" | "advisory";
                message: string;
                remediation: string;
                occurrenceCount?: number;
                sources: string[];
                standards?: {
                    id: string;
                    url?: string;
                }[];
                evidence?: {
                    kind: "http";
                    status: number | null;
                    failure?: "dns" | "tls" | "connect" | "timeout" | "private_host" | "redirects";
                } | {
                    kind: "clients";
                    unsupported: string[];
                } | {
                    kind: "judgment";
                    question: string;
                    probability: number;
                };
                target: {
                    kind: "email";
                } | {
                    kind: "subject";
                } | {
                    kind: "preview_text";
                } | {
                    kind: "link";
                    index: number;
                    displayUrl: string;
                } | {
                    kind: "image";
                    index: number;
                    displayUrl: string;
                } | {
                    kind: "element";
                    selector: string;
                };
            }[];
            totalFindings: number;
            findingsTruncated: boolean;
            completion: {
                status: "complete";
                readiness: "ready" | "needs_review" | "not_ready";
                score: number;
            } | {
                status: "partial";
                readiness: "unknown" | "not_ready";
                score: null;
            };
        };
        EmailAuditRequest: {
            emailHtml: string;
            subject?: string;
            previewText?: string;
            sendingPurpose?: "marketing" | "transactional";
        } | {
            emailJsx: string;
            subject?: string;
            previewText?: string;
            sendingPurpose?: "marketing" | "transactional";
        } | {
            emailId: string;
            emailVersionId?: string;
            subject?: string;
            previewText?: string;
            sendingPurpose?: "marketing" | "transactional";
        };
        EmailClientPreviewResponse: {
            previewId: string;
            emailId: string;
            emailVersionId?: string;
            status: "queued" | "running" | "completed" | "partially_completed" | "failed";
            previews: {
                id: string;
                label: string;
                category: "gmail" | "outlook" | "apple" | "yahoo" | "other";
                os: string;
                dark: boolean;
                status: "running" | "completed" | "failed";
                imageUrl: string | null;
                reason?: "pending" | "upstream_unavailable" | "unsupported_client" | "render_failed" | "rehost_failed" | "expired" | "submission_unknown" | "authorization_changed" | "snapshot_unavailable";
                retryable: boolean;
            }[];
            pending: string[];
            createdAt: string;
            expiresAt: string;
            nextPollAfterMs: number;
            credits: {
                cost: number;
                status: "reserved" | "settled" | "released";
            };
        };
        EmailClientPreviewRequest: {
            emailVersionId?: string;
            clients?: string[];
        };
        EmailInboxPlacementTest: {
            testId: string;
            emailId: string;
            status: "queued" | "running" | "completed" | "partially_completed" | "failed";
            phase?: "sending" | "collecting";
            domainId: string;
            subject?: string;
            previewText?: string;
            emailVersionId?: string;
            seedCount: number;
            results: {
                overall: {
                    provider: string;
                    total: number;
                    inbox: number;
                    spam: number;
                    missing: number;
                    pending: number;
                    categories?: {
                        [key: string]: number;
                    };
                    folders?: {
                        [key: string]: number;
                    };
                    authentication?: {
                        spf?: "pass" | "fail" | "mixed";
                        dkim?: "pass" | "fail" | "mixed";
                        dmarc?: "pass" | "fail" | "mixed";
                    };
                };
                byProvider: {
                    provider: string;
                    total: number;
                    inbox: number;
                    spam: number;
                    missing: number;
                    pending: number;
                    categories?: {
                        [key: string]: number;
                    };
                    folders?: {
                        [key: string]: number;
                    };
                    authentication?: {
                        spf?: "pass" | "fail" | "mixed";
                        dkim?: "pass" | "fail" | "mixed";
                        dmarc?: "pass" | "fail" | "mixed";
                    };
                }[];
                authentication: {
                    spf?: string;
                    dkim?: string;
                    dmarc?: string;
                };
                spamFilter?: {
                    flagged: boolean;
                    score: number;
                    threshold: number;
                    rules: {
                        name: string;
                        score: number;
                        description?: string;
                    }[];
                };
                microsoftFilter?: {
                    spamConfidenceLevel: number;
                    bulkComplaintLevel: number;
                    sampleCount: number;
                    junked: boolean;
                };
                spoofingDetected?: boolean;
                headers?: {
                    listUnsubscribe: boolean;
                    oneClickUnsubscribe: boolean;
                    plainTextPart: boolean;
                    feedbackId: boolean;
                };
            } | null;
            diagnosis?: {
                id: "spoofing_detected" | "aggregate_auth_failure" | "provider_auth_failure" | "microsoft_junk_filtering" | "provider_spam_placement" | "promotions_tab_placement" | "bulk_folder_placement" | "content_filter_flagged" | "content_rule" | "missing_list_unsubscribe" | "missing_plain_text_part" | "seed_delivery_blocked";
                severity: "critical" | "warning" | "info";
                provider?: string;
                summary: string;
                remediation: string;
            }[];
            errorMessage?: string;
            createdAt: string;
            updatedAt: string;
        };
        EmailInboxPlacementRequest: {
            domainId: string;
            subject?: string;
            previewText?: string;
            emailVersionId?: string;
            providers?: string[];
        };
        EmailInboxPlacementTestList: {
            data: {
                testId: string;
                status: "queued" | "running" | "completed" | "partially_completed" | "failed";
                phase?: "sending" | "collecting";
                domainId: string;
                subject: string;
                previewText?: string;
                emailVersionId?: string;
                seedCount: number;
                overall: {
                    provider: string;
                    total: number;
                    inbox: number;
                    spam: number;
                    missing: number;
                    pending: number;
                    categories?: {
                        [key: string]: number;
                    };
                    folders?: {
                        [key: string]: number;
                    };
                    authentication?: {
                        spf?: "pass" | "fail" | "mixed";
                        dkim?: "pass" | "fail" | "mixed";
                        dmarc?: "pass" | "fail" | "mixed";
                    };
                } | null;
                createdAt: string;
                updatedAt: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        EmailGroupsListResponse: {
            data: {
                groupId: string;
                groupName: string;
                emailCount: number;
                createdBy?: string;
                createdByUserId?: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        EmailGroupCreateRequest: {
            name: string;
            emailIds?: string[];
        };
        EmailGroupPatchRequest: {
            name?: string;
            emailIds?: string[];
        };
        EmailGroupDeleteResponse: {
            groupId: string;
            deleted: boolean;
        };
        SendsListResponse: {
            data: {
                sendId: string;
                kind: "campaign" | "automation";
                messageClass?: "marketing" | "transactional";
                automationId?: string;
                nodeId?: string;
                automationRunId?: string;
                audienceRunId?: string;
                triggerInstanceId?: string;
                emailId: string;
                emailVersionId?: string;
                status: "scheduled" | "queued" | "running" | "paused" | "completed" | "partially_completed" | "failed" | "canceled";
                approvalState?: "pending" | "approved" | "rejected";
                pauseReason?: "manual" | "plan_limit" | "domain_unsendable" | "bounce_rate";
                subject?: string;
                previewText?: string;
                from?: {
                    email: string;
                    name?: string;
                };
                replyTo?: string;
                domainId?: string;
                audienceId?: string;
                audienceName?: string;
                recipientCount?: number;
                scheduledAt?: string;
                startedAt?: string;
                completedAt?: string;
                failedAt?: string;
                error?: string;
                stats?: {
                    sent: number;
                    delivered: number;
                    opened: number;
                    clicked: number;
                    bounced: number;
                    hardBounced?: number;
                    complained: number;
                    unsubscribed: number;
                };
                delivery?: {
                    accepted: number;
                    pending: number;
                    delayed: number;
                    delivered: number;
                    bounced: number;
                    failed: number;
                    providerSuppressed: number;
                    preSendSkipped: number;
                    renderFailed: number;
                    updatedAt: string;
                };
                gradualSend?: {
                    startingPercentage: number;
                    incrementPercentage: number;
                    interval: {
                        value: number;
                        unit: "hour";
                    } | {
                        value: number;
                        unit: "day";
                    };
                    timeZone: string;
                    rampEndsAt?: string;
                    currentTranche?: number;
                    sentSoFar?: number;
                    pausedAt?: string;
                    pauseReason?: "manual";
                    resumedAt?: string;
                };
                smartSend?: {
                    windowEndsAt?: string;
                    assignedViaModel?: number;
                    assignedImmediately?: number;
                    modelFallbacks?: number;
                };
                createdAt: string;
                updatedAt: string;
                events?: {
                    eventType: "sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "provider_suppressed" | "suppressed" | "quota_skipped" | "received" | "unsubscribed";
                    occurredAt: string;
                    recipientEmail?: string;
                    url?: string;
                    machineGenerated?: boolean;
                    clickBotReason?: string;
                }[];
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        SendEmailTestResponse: {
            status: "completed";
            recipient: string;
        };
        SendsPostResponse: {
            status: "queued" | "scheduled";
            sendId: string;
            scheduledAt?: string;
            warnings?: components["schemas"]["ApiWarning"][];
        } | {
            status: "pending_approval";
            sendId: string;
            scheduledAt?: string;
            warnings?: components["schemas"]["ApiWarning"][];
        };
        SendEmailRequest: {
            test: true;
            emailId: string;
            emailVersionId?: string;
            subject: string;
            previewText?: string;
            to: string;
            replyTo?: string;
            domainId?: string;
            from?: {
                email: string;
                name?: string;
            };
            variables?: {
                [key: string]: string;
            };
            payload?: {
                [key: string]: components["schemas"]["SendPayloadValue"];
            };
        } | {
            test?: false;
            emailId: string;
            emailVersionId?: string;
            subject: string;
            previewText?: string;
            replyTo?: string;
            from?: {
                email: string;
                name?: string;
            };
            consent?: {
                source: "api" | "form" | "import";
                capturedAt?: string;
                policyVersion?: string;
                evidence?: string;
            };
            domainId: string;
            audienceId?: string;
            to?: string | string[];
            scheduledAt?: string;
            gradualSend?: {
                startingPercentage: number;
                incrementPercentage: number;
                interval: {
                    value: number;
                    unit: "hour";
                } | {
                    value: number;
                    unit: "day";
                };
                timeZone: string;
            };
            smartSend?: boolean;
        };
        SendPayloadValue: SendPayloadValue;
        SendCancelResponse: {
            sendId: string;
            status: "canceled";
        };
        SendPauseResponse: {
            sendId: string;
            status: "paused";
        };
        SendResumeResponse: {
            sendId: string;
            status: "running";
        };
        AnalyticsOverviewResponse: {
            totals: {
                accepted?: number;
                sent: number;
                delivered: number;
                opened: number;
                clicked: number;
                bounced: number;
                complained: number;
                unsubscribed: number;
                failed: number;
                providerSuppressed?: number;
                suppressed: number;
                quotaSkipped?: number;
                preSendSkipped?: number;
                pending?: number;
                deliveryDelayed: number;
            };
            rates: {
                deliveryRate: number | null;
                openRate: number | null;
                clickRate: number | null;
                bounceRate: number | null;
                complaintRate: number | null;
                unsubscribeRate: number | null;
            };
            buckets: {
                at: string;
                sent: number;
                delivered: number;
                deliveryDelayed: number;
                opened: number;
                clicked: number;
                bounced: number;
                complained: number;
                failed: number;
                providerSuppressed?: number;
                suppressed: number;
                quotaSkipped?: number;
                unsubscribed: number;
            }[];
            granularity: "5m" | "1h" | "1d";
            timeZone: string;
            range: {
                from: string;
                to: string;
            };
            truncated: boolean;
        };
        AutomationAnalyticsResponse: {
            data: {
                automationId: string;
                name: string;
                published: boolean;
                triggerEventId?: string;
                runs: number;
                completed: number;
                failed: number;
                sent: number;
                delivered: number;
                opened: number;
                clicked: number;
                bounced: number;
                complained: number;
                unsubscribed: number;
                successRate: number | null;
                openRate: number | null;
                clickRate: number | null;
                clickThroughRate: number | null;
                unsubscribeRate: number | null;
                lastRunAt?: string;
                lastRunStatus?: string;
            }[];
            totals: {
                runs: number;
                completed: number;
                failed: number;
                sent: number;
                delivered: number;
                opened: number;
                clicked: number;
                bounced: number;
                complained: number;
                unsubscribed: number;
            };
            range: {
                from: string;
                to: string;
            };
            truncated: boolean;
        };
        EventsAnalyticsSuccessResponse: components["schemas"]["EventsAnalyticsResponse"] | components["schemas"]["EventsBreakdownResponse"];
        EventsAnalyticsResponse: {
            data: {
                id: string;
                occurredAt: string;
                domain: "email" | "automation" | "trigger" | "inbound";
                eventType: string;
                recipientEmail?: string;
                sendId?: string;
                emailId?: string;
                emailName?: string;
                automationId?: string;
                automationName?: string;
                nodeId?: string;
                automationRunId?: string;
                triggerInstanceId?: string;
                audienceRunId?: string;
                triggerEventId?: string;
                provider?: string;
                machineGenerated?: boolean;
                clickBotReason?: string;
                openBotReason?: string;
                openFetchSource?: string;
                mode?: "live" | "test";
                summary?: string;
                sendSource?: "audience" | "api" | "automation_manual" | "automation_integration" | "automation_custom";
                messageClass?: "marketing" | "transactional";
                sendContext?: string;
                triggerProvider?: string;
                triggerTitle?: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
            range: {
                from: string;
                to: string;
            };
        };
        EventsBreakdownResponse: {
            count: number;
            groups: {
                key: {
                    [key: string]: string | null;
                };
                bucket?: string;
                count: number;
                recipients?: number;
            }[];
            otherCount: number;
            range: {
                from: string;
                to: string;
            };
            truncated: boolean;
            coveredFrom?: string;
        };
        AutomationsPostRequest: {
            name: string;
            description?: string;
            triggerEventId?: string;
            nodes: ({
                id: string;
                label: string;
                description?: string;
                type: "trigger";
                config: {
                    actionType?: string;
                    eventName?: string;
                    mode?: "event";
                    triggerEventId?: string;
                } | {
                    actionType?: string;
                    eventName?: string;
                    mode: "manualAudience";
                    audienceId: string;
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "sendEmail";
                config: {
                    actionType?: string;
                    emailId: string;
                    emailVersionId: string;
                    domainId?: string;
                    subject: string;
                    previewText?: string;
                    fromName?: string;
                    replyTo?: string;
                    emailTitle?: string;
                    fromAddress?: string;
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "wait";
                config: {
                    actionType?: string;
                    duration: number;
                    unit: "ms" | "seconds" | "minutes" | "hours" | "days" | "weeks";
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "filter";
                config: {
                    actionType?: string;
                    mode?: "payload";
                    logicalOperator: "AND" | "OR";
                    conditions: ({
                        field: string;
                        type: "string";
                        operator: "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "ends_with";
                        value: string;
                    } | {
                        field: string;
                        type: "number";
                        operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                        value: number;
                    } | {
                        field: string;
                        type: "date";
                        operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                        value: string | number;
                    } | {
                        field: string;
                        type: "string";
                        operator: "in" | "not_in" | "contains_any" | "not_contains_any";
                        value: string[];
                    } | {
                        field: string;
                        type: "number";
                        operator: "in" | "not_in";
                        value: number[];
                    } | {
                        field: string;
                        type: "number";
                        operator: "between";
                        value: [
                            number,
                            number
                        ];
                    } | {
                        field: string;
                        type: "date";
                        operator: "between";
                        value: [
                            string | number,
                            string | number
                        ];
                    } | {
                        field: string;
                        type: "string";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "number";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "date";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "bool";
                        operator: "is_true" | "is_false";
                    })[];
                } | {
                    actionType?: string;
                    mode: "engagement";
                    sourceNodeId: string;
                    window: {
                        duration: number;
                        unit: "ms" | "seconds" | "minutes" | "hours" | "days" | "weeks";
                    };
                    branches: {
                        id: string;
                        label?: string;
                        condition: {
                            kind: "engaged" | "not_engaged" | "clicked_link";
                            events?: "opened" | "clicked" | "opened_or_clicked";
                            url?: string;
                            position?: "any" | "first" | "last";
                        };
                    }[];
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "split";
                config: {
                    actionType?: string;
                    mode: "percentage";
                    leftLabel: string;
                    rightLabel: string;
                    leftPercentage: number;
                    seed?: string;
                } | {
                    actionType?: string;
                    mode: "condition";
                    leftLabel: string;
                    rightLabel: string;
                    logicalOperator: "AND" | "OR";
                    conditions: ({
                        field: string;
                        type: "string";
                        operator: "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "ends_with";
                        value: string;
                    } | {
                        field: string;
                        type: "number";
                        operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                        value: number;
                    } | {
                        field: string;
                        type: "date";
                        operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                        value: string | number;
                    } | {
                        field: string;
                        type: "string";
                        operator: "in" | "not_in" | "contains_any" | "not_contains_any";
                        value: string[];
                    } | {
                        field: string;
                        type: "number";
                        operator: "in" | "not_in";
                        value: number[];
                    } | {
                        field: string;
                        type: "number";
                        operator: "between";
                        value: [
                            number,
                            number
                        ];
                    } | {
                        field: string;
                        type: "date";
                        operator: "between";
                        value: [
                            string | number,
                            string | number
                        ];
                    } | {
                        field: string;
                        type: "string";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "number";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "date";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "bool";
                        operator: "is_true" | "is_false";
                    })[];
                };
            })[];
            connections?: {
                from: string;
                to: string;
                branch?: string;
            }[];
            dryRun?: boolean;
        };
        AutomationsListResponse: {
            data: {
                automationId: string;
                automationVersionId: string;
                triggerEventId?: string;
                name: string;
                description?: string;
                version: number | "latest";
                published: boolean;
                isLive?: boolean;
                liveVersion?: number | "latest";
                liveAutomationVersionId?: string;
                warnings?: components["schemas"]["ApiWarning"][];
                paused?: boolean;
                pausedAt?: number;
                nodes?: ({
                    id: string;
                    label: string;
                    description?: string;
                    type: "trigger";
                    config: {
                        actionType?: string;
                        eventName?: string;
                        mode?: "event";
                        triggerEventId?: string;
                    } | {
                        actionType?: string;
                        eventName?: string;
                        mode: "manualAudience";
                        audienceId: string;
                    };
                } | {
                    id: string;
                    label: string;
                    description?: string;
                    type: "sendEmail";
                    config: {
                        actionType?: string;
                        emailId?: string;
                        emailVersionId?: string;
                        emailTitle?: string;
                        subject?: string;
                        previewText?: string;
                        fromName?: string;
                        fromAddress?: string;
                        domainId?: string;
                        replyTo?: string;
                        to?: unknown;
                        html?: string;
                        variables?: {
                            [key: string]: unknown;
                        };
                    };
                } | {
                    id: string;
                    label: string;
                    description?: string;
                    type: "wait";
                    config: {
                        actionType?: string;
                        duration: number;
                        unit: "ms" | "seconds" | "minutes" | "hours" | "days" | "weeks";
                    };
                } | {
                    id: string;
                    label: string;
                    description?: string;
                    type: "filter";
                    config: {
                        actionType?: string;
                        mode?: "payload";
                        logicalOperator: "AND" | "OR";
                        conditions: {
                            field: string;
                            operator: string;
                            value?: string | number | boolean | (string | number)[];
                            type?: "string" | "number" | "date" | "bool";
                        }[];
                    } | {
                        actionType?: string;
                        mode: "engagement";
                        sourceNodeId: string;
                        window: {
                            duration: number;
                            unit: "ms" | "seconds" | "minutes" | "hours" | "days" | "weeks";
                        };
                        branches: {
                            id: string;
                            label?: string;
                            condition: {
                                kind: "engaged" | "not_engaged" | "clicked_link";
                                events?: "opened" | "clicked" | "opened_or_clicked";
                                url?: string;
                                position?: "any" | "first" | "last";
                            };
                        }[];
                    };
                } | {
                    id: string;
                    label: string;
                    description?: string;
                    type: "split";
                    config: {
                        actionType?: string;
                        mode: "percentage";
                        leftLabel: string;
                        rightLabel: string;
                        leftPercentage: number;
                        seed?: string;
                    } | {
                        actionType?: string;
                        mode: "condition";
                        leftLabel: string;
                        rightLabel: string;
                        logicalOperator: "AND" | "OR";
                        conditions: {
                            field: string;
                            operator: string;
                            value?: string | number | boolean | (string | number)[];
                            type?: "string" | "number" | "date" | "bool";
                        }[];
                    };
                })[];
                connections?: {
                    from: string;
                    to: string;
                    branch?: string;
                }[];
                emailIds: string[];
                createdBy?: string;
                createdByUserId?: string;
                publishedBy?: string;
                publishedByUserId?: string;
                createdAt?: string;
                updatedAt?: string;
                publishedAt?: string;
                versions?: {
                    version: number | "latest";
                    automationVersionId: string;
                }[];
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        AutomationsUpdateRequest: {
            name?: string;
            description?: string;
            nodes?: ({
                id: string;
                label: string;
                description?: string;
                type: "trigger";
                config: {
                    actionType?: string;
                    eventName?: string;
                    mode?: "event";
                    triggerEventId?: string;
                } | {
                    actionType?: string;
                    eventName?: string;
                    mode: "manualAudience";
                    audienceId: string;
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "sendEmail";
                config: {
                    actionType?: string;
                    emailId: string;
                    emailVersionId: string;
                    domainId?: string;
                    subject: string;
                    previewText?: string;
                    fromName?: string;
                    replyTo?: string;
                    emailTitle?: string;
                    fromAddress?: string;
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "wait";
                config: {
                    actionType?: string;
                    duration: number;
                    unit: "ms" | "seconds" | "minutes" | "hours" | "days" | "weeks";
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "filter";
                config: {
                    actionType?: string;
                    mode?: "payload";
                    logicalOperator: "AND" | "OR";
                    conditions: ({
                        field: string;
                        type: "string";
                        operator: "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "ends_with";
                        value: string;
                    } | {
                        field: string;
                        type: "number";
                        operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                        value: number;
                    } | {
                        field: string;
                        type: "date";
                        operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                        value: string | number;
                    } | {
                        field: string;
                        type: "string";
                        operator: "in" | "not_in" | "contains_any" | "not_contains_any";
                        value: string[];
                    } | {
                        field: string;
                        type: "number";
                        operator: "in" | "not_in";
                        value: number[];
                    } | {
                        field: string;
                        type: "number";
                        operator: "between";
                        value: [
                            number,
                            number
                        ];
                    } | {
                        field: string;
                        type: "date";
                        operator: "between";
                        value: [
                            string | number,
                            string | number
                        ];
                    } | {
                        field: string;
                        type: "string";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "number";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "date";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "bool";
                        operator: "is_true" | "is_false";
                    })[];
                } | {
                    actionType?: string;
                    mode: "engagement";
                    sourceNodeId: string;
                    window: {
                        duration: number;
                        unit: "ms" | "seconds" | "minutes" | "hours" | "days" | "weeks";
                    };
                    branches: {
                        id: string;
                        label?: string;
                        condition: {
                            kind: "engaged" | "not_engaged" | "clicked_link";
                            events?: "opened" | "clicked" | "opened_or_clicked";
                            url?: string;
                            position?: "any" | "first" | "last";
                        };
                    }[];
                };
            } | {
                id: string;
                label: string;
                description?: string;
                type: "split";
                config: {
                    actionType?: string;
                    mode: "percentage";
                    leftLabel: string;
                    rightLabel: string;
                    leftPercentage: number;
                    seed?: string;
                } | {
                    actionType?: string;
                    mode: "condition";
                    leftLabel: string;
                    rightLabel: string;
                    logicalOperator: "AND" | "OR";
                    conditions: ({
                        field: string;
                        type: "string";
                        operator: "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "ends_with";
                        value: string;
                    } | {
                        field: string;
                        type: "number";
                        operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                        value: number;
                    } | {
                        field: string;
                        type: "date";
                        operator: "equals" | "not_equals" | "gt" | "gte" | "lt" | "lte";
                        value: string | number;
                    } | {
                        field: string;
                        type: "string";
                        operator: "in" | "not_in" | "contains_any" | "not_contains_any";
                        value: string[];
                    } | {
                        field: string;
                        type: "number";
                        operator: "in" | "not_in";
                        value: number[];
                    } | {
                        field: string;
                        type: "number";
                        operator: "between";
                        value: [
                            number,
                            number
                        ];
                    } | {
                        field: string;
                        type: "date";
                        operator: "between";
                        value: [
                            string | number,
                            string | number
                        ];
                    } | {
                        field: string;
                        type: "string";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "number";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "date";
                        operator: "is_empty" | "is_not_empty";
                    } | {
                        field: string;
                        type: "bool";
                        operator: "is_true" | "is_false";
                    })[];
                };
            })[];
            connections?: {
                from: string;
                to: string;
                branch?: string;
            }[];
            triggerEventId?: string;
            expectedBaseVersionId?: string;
            expectedBaseDefinitionSha256?: string;
            dryRun?: boolean;
            published?: boolean;
            automationVersionId?: string;
            stopInFlight?: boolean;
            paused?: boolean;
        };
        AutomationsDeleteResponse: {
            automationId: string;
            deleted: boolean;
        };
        AutomationRunStartedResponse: {
            triggerInstanceId?: string;
            automationRunIds: string[];
            testMode?: "smoke" | "scenario";
            status: "triggered" | "idempotent_replay" | "test_started" | "replay_started";
            counts?: {
                automations: number;
            };
            receivedAt: string;
            warnings?: ({
                code: string;
                field: string;
                message: string;
                expectedType?: string;
                actualType?: string;
            } & {
                [key: string]: unknown;
            })[];
            runs?: {
                automationRunId: string;
                automationId: string;
                automationVersionId?: string;
                definitionHash?: string;
                triggerInstanceId?: string;
                mode: "live" | "test";
                status: "queued" | "running" | "completed" | "failed" | "canceled";
                recipientEmail?: string;
                startedAt?: string;
                completedAt?: string;
                error?: string;
                testCoverage?: {
                    mode: "smoke" | "scenario";
                    complete: boolean;
                    visitedNodes: string[];
                    unvisitedNodes: string[];
                    traversedConnections: {
                        from: string;
                        to: string;
                        branch?: string;
                    }[];
                    untraversedConnections: {
                        from: string;
                        to: string;
                        branch?: string;
                    }[];
                    decisions: {
                        nodeId: string;
                        branch: string;
                        source: "simulated" | "forced" | "deterministic" | "payload" | "smoke" | "upstream_not_delivered";
                    }[];
                    limitations: string[];
                };
                logs?: {
                    automationRunId: string;
                    nodeId: string;
                    nodeName: string;
                    nodeType: "trigger" | "wait" | "filter" | "split" | "sendEmail";
                    status: "running" | "completed" | "failed" | "skipped";
                    orderIndex: number;
                    branch?: string;
                    durationMs?: number;
                    startedAt: string;
                    completedAt?: string;
                    error?: string;
                }[];
                logsTruncated?: boolean;
            }[];
        };
        AutomationTestRequest: {
            payload?: {
                [key: string]: unknown;
            };
            testRecipient?: string;
            scenario?: {
                engagement?: {
                    nodeId: string;
                    events: ({
                        type: "opened";
                        afterMs: number;
                    } | {
                        type: "clicked";
                        afterMs: number;
                        url: string;
                    })[];
                }[];
                splits?: {
                    nodeId: string;
                    branch: "left" | "right";
                }[];
            };
        };
        AutomationRunDryRunResponse: {
            dryRun: true;
            automationId: string;
            audienceId: string;
            audienceName?: string;
            recipientCount: number;
            sendNodeCount: number;
            scheduledAt?: string;
            warnings?: components["schemas"]["ApiWarning"][];
        };
        AudienceAutomationRunStartedResponse: {
            audienceRunId: string;
            automationId: string;
            status: "queued" | "scheduled";
            totalRecipients: number;
            warnings?: components["schemas"]["ApiWarning"][];
            workflowRunId?: string;
            approvalState?: "pending";
            receivedAt: string;
        };
        AutomationRunRequest: {
            dryRun?: boolean;
            scheduledAt?: string;
            gradualSend?: {
                startingPercentage: number;
                incrementPercentage: number;
                interval: {
                    value: number;
                    unit: "hour";
                } | {
                    value: number;
                    unit: "day";
                };
                timeZone: string;
            };
        };
        AudienceRunsListResponse: {
            data: {
                audienceRunId: string;
                automationId: string;
                automationName?: string;
                audienceId: string;
                audienceName?: string;
                status: "queued" | "scheduled" | "running" | "paused" | "completed" | "failed" | "canceled";
                approvalState?: "pending" | "approved" | "rejected";
                pauseReason?: "manual" | "plan_limit";
                scheduledAt?: string;
                totalRecipients?: number;
                sentCount?: number;
                failedCount?: number;
                skippedCount?: number;
                nodeStats?: {
                    nodeId: string;
                    nodeType: string;
                    status?: "running" | "completed" | "failed";
                    entered?: number;
                    sent?: number;
                    failed?: number;
                    skipped?: number;
                    startedAt?: string;
                    completedAt?: string;
                    sendId?: string;
                }[];
                gradualSend?: {
                    startingPercentage: number;
                    incrementPercentage: number;
                    interval: {
                        value: number;
                        unit: "hour";
                    } | {
                        value: number;
                        unit: "day";
                    };
                    timeZone: string;
                    rampEndsAt?: string;
                    currentTranche?: number;
                    sentSoFar?: number;
                    pausedAt?: string;
                    pauseReason?: "manual";
                    resumedAt?: string;
                };
                error?: string;
                stalledAt?: string;
                resumeGeneration?: number;
                resumedAt?: string;
                startedAt?: string;
                completedAt?: string;
                createdAt: string;
                updatedAt: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        AudienceRunActionResponse: {
            audienceRunId: string;
            status: "paused" | "running" | "canceled";
            resumedFrom?: "paused" | "failed";
        };
        AutomationRunsListResponse: {
            data: {
                automationRunId: string;
                automationId: string;
                automationVersionId?: string;
                definitionHash?: string;
                triggerInstanceId?: string;
                mode: "live" | "test";
                status: "queued" | "running" | "completed" | "failed" | "canceled";
                recipientEmail?: string;
                startedAt?: string;
                completedAt?: string;
                error?: string;
                testCoverage?: {
                    mode: "smoke" | "scenario";
                    complete: boolean;
                    visitedNodes: string[];
                    unvisitedNodes: string[];
                    traversedConnections: {
                        from: string;
                        to: string;
                        branch?: string;
                    }[];
                    untraversedConnections: {
                        from: string;
                        to: string;
                        branch?: string;
                    }[];
                    decisions: {
                        nodeId: string;
                        branch: string;
                        source: "simulated" | "forced" | "deterministic" | "payload" | "smoke" | "upstream_not_delivered";
                    }[];
                    limitations: string[];
                };
                logs?: {
                    automationRunId: string;
                    nodeId: string;
                    nodeName: string;
                    nodeType: "trigger" | "wait" | "filter" | "split" | "sendEmail";
                    status: "running" | "completed" | "failed" | "skipped";
                    orderIndex: number;
                    branch?: string;
                    durationMs?: number;
                    startedAt: string;
                    completedAt?: string;
                    error?: string;
                }[];
                logsTruncated?: boolean;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        AutomationRun: {
            automationRunId: string;
            automationId: string;
            automationVersionId?: string;
            definitionHash?: string;
            triggerInstanceId?: string;
            mode: "live" | "test";
            status: "queued" | "running" | "completed" | "failed" | "canceled";
            recipientEmail?: string;
            startedAt?: string;
            completedAt?: string;
            error?: string;
            testCoverage?: {
                mode: "smoke" | "scenario";
                complete: boolean;
                visitedNodes: string[];
                unvisitedNodes: string[];
                traversedConnections: {
                    from: string;
                    to: string;
                    branch?: string;
                }[];
                untraversedConnections: {
                    from: string;
                    to: string;
                    branch?: string;
                }[];
                decisions: {
                    nodeId: string;
                    branch: string;
                    source: "simulated" | "forced" | "deterministic" | "payload" | "smoke" | "upstream_not_delivered";
                }[];
                limitations: string[];
            };
            logs?: {
                automationRunId: string;
                nodeId: string;
                nodeName: string;
                nodeType: "trigger" | "wait" | "filter" | "split" | "sendEmail";
                status: "running" | "completed" | "failed" | "skipped";
                orderIndex: number;
                branch?: string;
                durationMs?: number;
                startedAt: string;
                completedAt?: string;
                error?: string;
            }[];
            logsTruncated?: boolean;
        };
        AutomationRunCancelResponse: {
            automationRunId: string;
            status: "canceled";
            previousStatus: "queued" | "running" | "completed" | "failed" | "canceled";
        };
        AutomationRunCancelRequest: {
            reason?: string;
        };
        BrewEventTriggerSaved: {
            triggerEventId: string;
            title: string;
            description?: string;
            provider: "brew_api" | "custom" | "brew_event" | "clerk" | "stytch" | "supabase" | "workos" | "stripe" | "shopify" | "revenuecat" | "framer" | "posthog" | "typeform" | "webflow" | "hubspot";
            providerEventKey?: string;
            brewEvent?: {
                event: "contact.unsubscribed";
                scope: "domain" | "all";
                domainHost?: string;
            };
            payloadSchema: {
                type: "object";
                fields: components["schemas"]["TriggerPayloadField"][];
            };
            createdAt: string;
            updatedAt: string;
            skill?: string;
            created: boolean;
        };
        BrewEventTriggersPostRequest: {
            event: "contact.unsubscribed";
            scope: "domain" | "all";
            domainId?: string;
        };
        IntegrationEventTriggerSaved: {
            triggerEventId: string;
            title: string;
            description?: string;
            provider: "brew_api" | "custom" | "brew_event" | "clerk" | "stytch" | "supabase" | "workos" | "stripe" | "shopify" | "revenuecat" | "framer" | "posthog" | "typeform" | "webflow" | "hubspot";
            providerEventKey?: string;
            payloadSchema: {
                type: "object";
                fields: components["schemas"]["TriggerPayloadField"][];
            };
            createdAt: string;
            updatedAt: string;
            created: boolean;
            propertiesStatus: "current" | "stored" | "rate_limited" | "unavailable";
            retryAfterSeconds?: number;
        };
        IntegrationEventTriggersPostRequest: {
            eventId: string;
        };
        TriggersPostRequest: {
            title: string;
            description?: string;
            payloadSchema: {
                type: "object";
                fields: components["schemas"]["TriggerPayloadField"][];
            };
        };
        TriggersListResponse: {
            data: {
                triggerEventId: string;
                title: string;
                description?: string;
                provider: "brew_api" | "custom" | "brew_event" | "clerk" | "stytch" | "supabase" | "workos" | "stripe" | "shopify" | "revenuecat" | "framer" | "posthog" | "typeform" | "webflow" | "hubspot";
                providerEventKey?: string;
                brewEvent?: {
                    event: "contact.unsubscribed";
                    scope: "domain" | "all";
                    domainHost?: string;
                };
                payloadSchema: {
                    type: "object";
                    fields: components["schemas"]["TriggerPayloadField"][];
                };
                createdAt: string;
                updatedAt: string;
                skill?: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        TriggersPatchRequest: {
            title?: string;
            description?: string;
            payloadSchema?: {
                type: "object";
                fields: components["schemas"]["TriggerPayloadField"][];
            };
        };
        TriggersDeleteResponse: {
            triggerEventId: string;
            deleted: boolean;
        };
        TriggerReadiness: {
            triggerEventId: string;
            ready: boolean;
            blockers: {
                code: "NO_PUBLISHED_AUTOMATION";
                message: string;
            }[];
            title?: string;
            description?: string;
            provider?: string;
            providerEventKey?: string;
            payloadSchema?: {
                type: "object";
                fields: components["schemas"]["TriggerPayloadField"][];
            };
            endpoint?: string;
            publishedAutomations: ({
                automationId: string;
                name?: string;
                primaryFromAddress?: string;
            } & {
                [key: string]: unknown;
            })[];
            counts: {
                automations: number;
                skipped: number;
            };
            delivery?: {
                status: "received" | "never_received" | "none_recent" | "waiting_for_test_event";
                lastReceivedAt?: string;
                sourceEvent?: string;
                message: string;
            };
        };
        TriggerFireAccepted: {
            triggerInstanceId: string;
            triggerEventId: string;
            status: "triggered" | "replayed";
            automationRunIds: string[];
            notStarted?: {
                automationId: string;
                reason: string;
            }[];
            publishedAutomations: ({
                automationId: string;
                name?: string;
                primaryFromAddress?: string;
            } & {
                [key: string]: unknown;
            })[];
            counts: {
                automations: number;
                skipped: number;
            };
            warnings: ({
                code: string;
                field: string;
                message: string;
                expectedType?: string;
                actualType?: string;
            } & {
                [key: string]: unknown;
            })[];
            receivedAt: string;
        };
        TriggerFireRequest: {
            payload: {
                [key: string]: unknown;
            };
        };
        PayloadContractGetResponse: {
            subjectKind: "trigger";
            subjectId: string;
            source: "stored" | "derived_from_schema" | "derived_from_template";
            typeName: string;
            contractHash?: string;
            version?: number;
            enforcement?: "off" | "prune" | "strict";
            driftStatus?: "fresh" | "stale";
            format: "json";
            fields: components["schemas"]["PayloadContractStoredFieldNode"][];
        } | {
            subjectKind: "trigger";
            subjectId: string;
            source: "stored" | "derived_from_schema" | "derived_from_template";
            typeName: string;
            contractHash?: string;
            version?: number;
            enforcement?: "off" | "prune" | "strict";
            driftStatus?: "fresh" | "stale";
            format: "ts" | "zod" | "jsonschema" | "skill";
            content: string;
        };
        PayloadContractStoredFieldNode: {
            key: string;
            type: "string" | "int" | "float" | "boolean" | "date" | "enum" | "object" | "array" | "unknown";
            required: boolean;
            description?: string;
            exampleValue?: string | number | boolean;
            fallbackValue?: string | number | boolean;
            pii?: "none" | "low" | "high";
            secret?: boolean;
            syncToContact?: boolean;
            enumValues?: string[];
            itemType?: ("string" | "int" | "float" | "boolean" | "date" | "enum") | "unknown";
            usedIn?: ("body" | "subject" | "previewText")[];
            children?: components["schemas"]["PayloadContractStoredFieldNode"][];
        };
        PayloadContractPutResponse: {
            subjectKind: "trigger";
            subjectId: string;
            source: "stored" | "derived_from_schema" | "derived_from_template";
            typeName: string;
            contractHash?: string;
            version?: number;
            enforcement?: "off" | "prune" | "strict";
            driftStatus?: "fresh" | "stale";
            format: "json";
            fields: components["schemas"]["PayloadContractStoredFieldNode"][];
            warnings: components["schemas"]["ApiWarning"][];
        };
        PayloadContractPutRequest: {
            fields?: components["schemas"]["PayloadContractFieldNode"][];
            name?: string;
            enforcement?: "off" | "prune" | "strict";
        };
        PayloadContractFieldNode: {
            key: string;
            type: "string" | "int" | "float" | "boolean" | "date" | "enum" | "object" | "array" | "unknown";
            required: boolean;
            description?: string;
            exampleValue?: string | number | boolean;
            fallbackValue?: string | number | boolean;
            pii?: "none" | "low" | "high";
            secret?: boolean;
            syncToContact?: boolean;
            enumValues?: string[];
            itemType?: ("string" | "int" | "float" | "boolean" | "date" | "enum") | "unknown";
            usedIn?: ("body" | "subject" | "previewText")[];
            children?: components["schemas"]["PayloadContractFieldNode"][];
        };
        PayloadContractValidateResponse: {
            valid: boolean;
            errors: {
                code: "payload_not_object" | "missing_required" | "invalid_type" | "unexpected_key" | "required_satisfied_by_fallback" | "invalid_email";
                field: string;
                message: string;
                expectedType?: string;
                actualType?: string;
            }[];
            warnings: {
                code: "payload_not_object" | "missing_required" | "invalid_type" | "unexpected_key" | "required_satisfied_by_fallback" | "invalid_email";
                field: string;
                message: string;
                expectedType?: string;
                actualType?: string;
            }[];
            resolvedPayload: {
                [key: string]: unknown;
            };
            prunedKeys: string[];
            source: "stored" | "derived_from_schema" | "derived_from_template";
            contractHash?: string;
        };
        PayloadContractValidateRequest: {
            payload: {
                [key: string]: unknown;
            };
            enforcement?: "prune" | "strict";
        };
        PayloadContractInferResponse: {
            fields: components["schemas"]["PayloadContractFieldNode"][];
            issues: {
                message: string;
            }[];
        };
        PayloadContractInferRequest: {
            example: {
                [key: string]: unknown;
            };
            subjectKind?: "trigger";
        };
        TriggerInstancesListResponse: {
            data: {
                triggerInstanceId: string;
                source: "api" | "integration" | "brew_event";
                provider?: string;
                triggerEventId?: string;
                state: "received" | "verified" | "matched" | "partially_fired" | "fired" | "rejected" | "dead_letter";
                matchedAutomationIds: string[];
                automationRunIds: string[];
                rejectionReason?: string;
                attempts: number;
                receivedAt: string;
                processedAt?: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        ContactsPostBatchResponse: {
            summary: {
                inserted: number;
                updated: number;
                failed: number;
            };
            fieldsCreated: string[];
            errors: {
                email: string;
                row?: number;
                code: string;
                field?: string;
                message: string;
            }[];
            warnings: {
                code: string;
                email?: string;
                row?: number;
                field?: string;
                message: string;
                from?: string;
                to?: string;
                original?: string;
                normalized?: string;
            }[];
            validation?: {
                valid: number;
                risky: number;
                invalid: number;
                unscored: number;
                persistence?: {
                    matched: number;
                    modified: number;
                    failed: number;
                };
            };
            validationJobId?: string;
        };
        ContactsPostSingleResponse: {
            contact: {
                email: string;
                firstName?: string;
                lastName?: string;
                subscribed?: boolean;
                consent?: {
                    source: "api" | "form" | "import" | "app" | "integration";
                    capturedAt: string;
                    policyVersion?: string;
                    evidence?: string;
                };
                validationStatus?: "valid" | "risky" | "invalid";
                suppressed?: boolean;
                suppressedReason?: string | null;
                unsubscribedDomains?: string[];
                lastValidatedAt?: string;
                validationDetails?: {
                    provider: "brew";
                    reason?: string;
                    didYouMean?: string;
                    risk?: string;
                    isDisposable?: boolean;
                    isRole?: boolean;
                };
                createdAt: string;
                updatedAt: string;
                importId?: string | null;
                csvFileName?: string | null;
                customFields?: {
                    [key: string]: unknown;
                };
            };
            created: boolean;
            fieldsCreated: string[];
            warnings: {
                code: string;
                email?: string;
                row?: number;
                field?: string;
                message: string;
                from?: string;
                to?: string;
                original?: string;
                normalized?: string;
            }[];
            validation?: {
                valid: number;
                risky: number;
                invalid: number;
                unscored: number;
                persistence?: {
                    matched: number;
                    modified: number;
                    failed: number;
                };
            };
        };
        ContactsPostRequest: components["schemas"]["ContactsPostSingleRequest"] | components["schemas"]["ContactsPostBatchRequest"];
        ContactsPostSingleRequest: {
            email: string;
            firstName?: string;
            lastName?: string;
            subscribed?: boolean;
            customFields?: {
                [key: string]: unknown;
            };
            consent?: {
                source: "api" | "form" | "import";
                capturedAt?: string;
                policyVersion?: string;
                evidence?: string;
            };
            validate?: boolean;
        };
        ContactsPostBatchRequest: {
            contacts: {
                email?: string;
                firstName?: string;
                lastName?: string;
                subscribed?: boolean;
                customFields?: {
                    [key: string]: unknown;
                };
                consent?: {
                    source: "api" | "form" | "import";
                    capturedAt?: string;
                    policyVersion?: string;
                    evidence?: string;
                };
            }[];
            validate?: boolean;
            consent?: {
                source: "api" | "form" | "import";
                capturedAt?: string;
                policyVersion?: string;
                evidence?: string;
            };
        };
        ContactsPatchResponse: {
            contact: {
                email: string;
                firstName?: string;
                lastName?: string;
                subscribed?: boolean;
                consent?: {
                    source: "api" | "form" | "import" | "app" | "integration";
                    capturedAt: string;
                    policyVersion?: string;
                    evidence?: string;
                };
                validationStatus?: "valid" | "risky" | "invalid";
                suppressed?: boolean;
                suppressedReason?: string | null;
                unsubscribedDomains?: string[];
                lastValidatedAt?: string;
                validationDetails?: {
                    provider: "brew";
                    reason?: string;
                    didYouMean?: string;
                    risk?: string;
                    isDisposable?: boolean;
                    isRole?: boolean;
                };
                createdAt: string;
                updatedAt: string;
                importId?: string | null;
                csvFileName?: string | null;
                customFields?: {
                    [key: string]: unknown;
                };
            };
            updated: string[];
            warnings: {
                code: string;
                email?: string;
                row?: number;
                field?: string;
                message: string;
                from?: string;
                to?: string;
                original?: string;
                normalized?: string;
            }[];
        };
        ContactsPatchRequest: {
            fields?: {
                [key: string]: unknown;
            };
            consent?: {
                source: "api" | "form" | "import";
                capturedAt?: string;
                policyVersion?: string;
                evidence?: string;
            };
        };
        ContactDeleteResponse: {
            email: string;
            deleted: boolean;
        };
        ContactsListResponse: {
            data: {
                email: string;
                firstName?: string;
                lastName?: string;
                subscribed?: boolean;
                consent?: {
                    source: "api" | "form" | "import" | "app" | "integration";
                    capturedAt: string;
                    policyVersion?: string;
                    evidence?: string;
                };
                validationStatus?: "valid" | "risky" | "invalid";
                suppressed?: boolean;
                suppressedReason?: string | null;
                unsubscribedDomains?: string[];
                lastValidatedAt?: string;
                validationDetails?: {
                    provider: "brew";
                    reason?: string;
                    didYouMean?: string;
                    risk?: string;
                    isDisposable?: boolean;
                    isRole?: boolean;
                };
                createdAt: string;
                updatedAt: string;
                importId?: string | null;
                csvFileName?: string | null;
                customFields?: {
                    [key: string]: unknown;
                };
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        ContactWithOpenProfile: {
            email: string;
            firstName?: string;
            lastName?: string;
            subscribed?: boolean;
            consent?: {
                source: "api" | "form" | "import" | "app" | "integration";
                capturedAt: string;
                policyVersion?: string;
                evidence?: string;
            };
            validationStatus?: "valid" | "risky" | "invalid";
            suppressed?: boolean;
            suppressedReason?: string | null;
            unsubscribedDomains?: string[];
            lastValidatedAt?: string;
            validationDetails?: {
                provider: "brew";
                reason?: string;
                didYouMean?: string;
                risk?: string;
                isDisposable?: boolean;
                isRole?: boolean;
            };
            createdAt: string;
            updatedAt: string;
            importId?: string | null;
            csvFileName?: string | null;
            customFields?: {
                [key: string]: unknown;
            };
            openProfile?: {
                totalOpens: number;
                lastOpenedAt: string;
                bestOpenMinuteUtc?: number;
                bestSendMinuteUtc?: number;
                confidence?: number;
                histogram: number[];
            } | null;
        };
        ContactsSearchSuccessResponse: components["schemas"]["ContactsListResponse"] | components["schemas"]["ContactsWithOpenProfileListResponse"] | components["schemas"]["ContactsCountResponse"];
        ContactsWithOpenProfileListResponse: {
            data: {
                email: string;
                firstName?: string;
                lastName?: string;
                subscribed?: boolean;
                consent?: {
                    source: "api" | "form" | "import" | "app" | "integration";
                    capturedAt: string;
                    policyVersion?: string;
                    evidence?: string;
                };
                validationStatus?: "valid" | "risky" | "invalid";
                suppressed?: boolean;
                suppressedReason?: string | null;
                unsubscribedDomains?: string[];
                lastValidatedAt?: string;
                validationDetails?: {
                    provider: "brew";
                    reason?: string;
                    didYouMean?: string;
                    risk?: string;
                    isDisposable?: boolean;
                    isRole?: boolean;
                };
                createdAt: string;
                updatedAt: string;
                importId?: string | null;
                csvFileName?: string | null;
                customFields?: {
                    [key: string]: unknown;
                };
                openProfile?: {
                    totalOpens: number;
                    lastOpenedAt: string;
                    bestOpenMinuteUtc?: number;
                    bestSendMinuteUtc?: number;
                    confidence?: number;
                    histogram: number[];
                } | null;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        ContactsCountResponse: {
            count: number;
            groups?: {
                key: {
                    [key: string]: string | number | boolean | null;
                };
                bucket?: string | null;
                count: number;
            }[];
            otherCount?: number;
        };
        ContactsSearchRequest: {
            search?: string;
            filters?: {
                field: string;
                operator: string;
                value: string;
            }[];
            audienceId?: string;
            logic?: "and" | "or" | "none";
            sort?: string;
            order?: "asc" | "desc";
            count?: boolean;
            groupBy?: string[];
            bucket?: "day" | "week" | "month";
            limit?: number;
            cursor?: string;
            include?: "openProfile"[];
        };
        ContactsValidateResponse: {
            data: ({
                email: string;
                valid: boolean;
                status: "valid" | "risky" | "invalid";
                checkOutcome: "completed";
                reason?: string;
                didYouMean?: string;
                risk?: string;
                isDisposable?: boolean;
                isRole?: boolean;
            } | {
                email: string;
                valid: false;
                status: "risky";
                checkOutcome: "unavailable";
                reason: "validation_unavailable";
            })[];
            persistence: {
                matched: number;
                modified: number;
                failed: number;
            };
        };
        ContactsValidateRequest: {
            emails: string[];
        };
        ContactsImportResponse: {
            summary: {
                inserted: number;
                updated: number;
                failed: number;
                skipped: number;
                total: number;
            };
            fieldsCreated: string[];
            errors: {
                email: string;
                row?: number;
                code: string;
                field?: string;
                message: string;
            }[];
            warnings: {
                code: string;
                email?: string;
                row?: number;
                field?: string;
                message: string;
                from?: string;
                to?: string;
                original?: string;
                normalized?: string;
            }[];
            validation?: {
                valid: number;
                risky: number;
                invalid: number;
                unscored: number;
                persistence?: {
                    matched: number;
                    modified: number;
                    failed: number;
                };
            };
            validationJobId?: string;
            importId?: string;
            dryRun?: true;
        };
        ContactsImportCsvRequest: {
            csv: string;
            mapping?: {
                [key: string]: string;
            };
            validate?: boolean;
            consent?: {
                source: "api" | "form" | "import";
                capturedAt?: string;
                policyVersion?: string;
                evidence?: string;
            };
            dateOrder?: "month_first" | "day_first";
            fileName?: string;
            dryRun?: boolean;
            onConflict?: "upsert" | "skip";
        };
        ContactsImportRequest: {
            contacts: {
                email?: string;
                firstName?: string;
                lastName?: string;
                subscribed?: boolean;
                customFields?: {
                    [key: string]: unknown;
                };
                consent?: {
                    source: "api" | "form" | "import";
                    capturedAt?: string;
                    policyVersion?: string;
                    evidence?: string;
                };
            }[];
            validate?: boolean;
            consent?: {
                source: "api" | "form" | "import";
                capturedAt?: string;
                policyVersion?: string;
                evidence?: string;
            };
            fileName?: string;
            dryRun?: boolean;
            onConflict?: "upsert" | "skip";
        };
        ContactsBatchDeleteResponse: {
            deletedCount: number;
            notFound: string[];
        };
        ContactsBatchDeleteRequest: {
            emails: string[];
        };
        FieldsGetResponse: {
            data: {
                fieldName: string;
                fieldType: "string" | "number" | "date" | "bool";
                label?: string;
                isCore?: boolean;
                isFilterable?: boolean;
                isSortable?: boolean;
                isSearchable?: boolean;
                coverage?: {
                    percent: number;
                    approximate: boolean;
                    topValues: {
                        value: string;
                        count: number;
                        percent: number;
                    }[];
                    dominantValue?: string;
                };
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        FieldsPostRequest: {
            fieldName: string;
            fieldType: "string" | "number" | "date" | "bool";
        };
        FieldsDeleteResponse: {
            fieldName: string;
            deleted: boolean;
        };
        AudiencesListResponse: {
            data: {
                audienceId: string;
                audienceName: string;
                filters: {
                    filters: {
                        field: string;
                        operator: "equals" | "not_equals" | "contains" | "not_contains" | "contains_any" | "not_contains_any" | "starts_with" | "ends_with" | "gt" | "gte" | "lt" | "lte" | "between" | "is_true" | "is_false" | "in" | "not_in" | "is_empty" | "not_exists" | "is_not_empty" | "exists" | "is_set" | "before" | "after" | "on_date";
                        value?: unknown;
                        type?: string;
                    }[];
                    logicalOperator: "and" | "or";
                };
                count: number;
                materializationStatus?: "pending" | "running" | "ready" | "failed";
                createdAt: string;
                updatedAt: string;
                build?: {
                    jobId: string;
                    status: "queued" | "running" | "completed" | "partially_completed" | "failed";
                    cohort: {
                        eventTypes: ("sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "skipped" | "unsubscribed")[];
                        from: string;
                        to: string;
                        sendId?: string;
                        emailId?: string;
                        automationIds?: string[];
                        audienceIds?: string[];
                        recipient?: string[];
                        includeMachineClicks?: boolean;
                        exclude?: {
                            baseAudienceId: string;
                        };
                    };
                    field: {
                        key: string;
                        label: string;
                        type: "date";
                    };
                    counts: {
                        eventsScanned: number;
                        stampedContacts?: number;
                    };
                    error?: string;
                    enqueuedAt: string;
                    completedAt?: string;
                };
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        AudienceWriteResponse: {
            audienceId: string;
            audienceName: string;
            filters: {
                filters: {
                    field: string;
                    operator: "equals" | "not_equals" | "contains" | "not_contains" | "contains_any" | "not_contains_any" | "starts_with" | "ends_with" | "gt" | "gte" | "lt" | "lte" | "between" | "is_true" | "is_false" | "in" | "not_in" | "is_empty" | "not_exists" | "is_not_empty" | "exists" | "is_set" | "before" | "after" | "on_date";
                    value?: unknown;
                    type?: string;
                }[];
                logicalOperator: "and" | "or";
            };
            count: number;
            materializationStatus?: "pending" | "running" | "ready" | "failed";
            createdAt: string;
            updatedAt: string;
            build?: {
                jobId: string;
                status: "queued" | "running" | "completed" | "partially_completed" | "failed";
                cohort: {
                    eventTypes: ("sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "skipped" | "unsubscribed")[];
                    from: string;
                    to: string;
                    sendId?: string;
                    emailId?: string;
                    automationIds?: string[];
                    audienceIds?: string[];
                    recipient?: string[];
                    includeMachineClicks?: boolean;
                    exclude?: {
                        baseAudienceId: string;
                    };
                };
                field: {
                    key: string;
                    label: string;
                    type: "date";
                };
                counts: {
                    eventsScanned: number;
                    stampedContacts?: number;
                };
                error?: string;
                enqueuedAt: string;
                completedAt?: string;
            };
            emailListMaterializations?: {
                fieldName: string;
                providedEmails: number;
                matchedContacts: number;
            }[];
            membership?: {
                added: string[];
                alreadyPresent: string[];
                unExcluded: string[];
                removedFromList: string[];
                excludedByFilter: string[];
                notAMember: string[];
                noContactYet: string[];
            };
        };
        AudiencesPostRequest: {
            name: string;
            filters: {
                filters: {
                    field: string;
                    operator: "equals" | "not_equals" | "contains" | "not_contains" | "contains_any" | "not_contains_any" | "starts_with" | "ends_with" | "gt" | "gte" | "lt" | "lte" | "between" | "is_true" | "is_false" | "in" | "not_in" | "is_empty" | "not_exists" | "is_not_empty" | "exists" | "is_set" | "before" | "after" | "on_date";
                    value?: unknown;
                    type?: string;
                }[];
                logicalOperator: "and" | "or";
            };
        };
        AudiencesFromEventsResponse: {
            audienceId: string;
            audienceName: string;
            filters: {
                filters: {
                    field: string;
                    operator: "equals" | "not_equals" | "contains" | "not_contains" | "contains_any" | "not_contains_any" | "starts_with" | "ends_with" | "gt" | "gte" | "lt" | "lte" | "between" | "is_true" | "is_false" | "in" | "not_in" | "is_empty" | "not_exists" | "is_not_empty" | "exists" | "is_set" | "before" | "after" | "on_date";
                    value?: unknown;
                    type?: string;
                }[];
                logicalOperator: "and" | "or";
            };
            count: number;
            materializationStatus: "pending" | "running" | "ready" | "failed";
            createdAt: string;
            updatedAt: string;
            build: {
                jobId: string;
                status: "queued" | "running" | "completed" | "partially_completed" | "failed";
                cohort: {
                    eventTypes: ("sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "skipped" | "unsubscribed")[];
                    from: string;
                    to: string;
                    sendId?: string;
                    emailId?: string;
                    automationIds?: string[];
                    audienceIds?: string[];
                    recipient?: string[];
                    includeMachineClicks?: boolean;
                    exclude?: {
                        baseAudienceId: string;
                    };
                };
                field: {
                    key: string;
                    label: string;
                    type: "date";
                };
                counts: {
                    eventsScanned: number;
                    stampedContacts?: number;
                };
                error?: string;
                enqueuedAt: string;
                completedAt?: string;
            };
        };
        AudiencesFromEventsRequest: {
            cohort: {
                eventTypes: ("sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "skipped" | "unsubscribed")[];
                from?: string;
                to?: string;
                sendId?: string;
                emailId?: string;
                automationIds?: string[];
                audienceIds?: string[];
                recipient?: string[];
                includeMachineClicks?: boolean;
                exclude?: {
                    baseAudienceId?: string;
                };
            };
            name?: string;
        };
        AudiencesPatchRequest: {
            name?: string;
            filters?: {
                filters: {
                    field: string;
                    operator: "equals" | "not_equals" | "contains" | "not_contains" | "contains_any" | "not_contains_any" | "starts_with" | "ends_with" | "gt" | "gte" | "lt" | "lte" | "between" | "is_true" | "is_false" | "in" | "not_in" | "is_empty" | "not_exists" | "is_not_empty" | "exists" | "is_set" | "before" | "after" | "on_date";
                    value?: unknown;
                    type?: string;
                }[];
                logicalOperator: "and" | "or";
            };
            addEmails?: string[];
            removeEmails?: string[];
            expectedUpdatedAt?: string;
        };
        AudiencesDeleteResponse: {
            audienceId: string;
            deleted: boolean;
        };
        DomainsListResponse: {
            data: {
                domainId: string;
                domainUrl: string;
                name: string;
                region: string;
                status: "not_started" | "pending" | "verified" | "failed" | "temporary_failure" | "partially_verified" | "partially_failed";
                sendingEnabled: boolean;
                sendable: boolean;
                sendingPurpose: "marketing" | "transactional";
                records: {
                    record: string;
                    name: string;
                    type: string;
                    ttl: string;
                    status: string;
                    value: string;
                    priority?: number;
                }[];
                openTracking?: boolean;
                clickTracking?: boolean;
                createdAt: string;
                updatedAt: string;
                verifiedAt?: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        DomainsPostRequest: {
            name: string;
            region?: "us-east-1";
            customReturnPath?: string;
            sendingPurpose?: "marketing" | "transactional";
        };
        DomainsPatchRequest: {
            defaultSenderName?: string;
            defaultFromEmail?: string;
            defaultReplyToEmail?: string;
            sendingPurpose?: "marketing" | "transactional";
        };
        DomainsDeleteResponse: {
            domainId: string;
            deleted: boolean;
        };
        DomainUnsubscribesListResponse: {
            domainId: string;
            domainHost: string;
            data: {
                email: string;
                scope: "domain" | "all" | "both";
                unsubscribedAt?: string;
                source?: "link" | "one_click" | "api" | "import" | "manual";
                sendId?: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        DomainUnsubscribesAddResponse: {
            domainId: string;
            domainHost: string;
            summary: {
                received: number;
                added: number;
                alreadyUnsubscribed: number;
                created: number;
                invalid: number;
            };
            invalid: {
                email: string;
                code: "INVALID_EMAIL";
            }[];
        };
        DomainUnsubscribesAddRequest: {
            emails: string[];
        };
        DomainUnsubscribeRemoveResponse: {
            domainId: string;
            domainHost: string;
            email: string;
            removed: boolean;
            globallyUnsubscribed: boolean;
        };
        DomainUnsubscribesImportResponse: {
            domainId: string;
            domainHost: string;
            summary: {
                rows: number;
                added: number;
                alreadyUnsubscribed: number;
                created: number;
                skipped: number;
            };
            skippedSample: string[];
            truncated: boolean;
            column: string | null;
        };
        DomainUnsubscribesImportRequest: {
            csv: string;
            column?: string;
        };
        DomainUnsubscribesExportResponse: {
            domainId: string;
            domainHost: string;
            csv: string;
            rowCount: number;
            truncated: boolean;
        };
        DomainHealth: {
            domainId: string;
            name: string;
            status: "not_started" | "pending" | "verified" | "failed" | "temporary_failure" | "partially_verified" | "partially_failed";
            sendable: boolean;
            verdict: "healthy" | "at_risk" | "critical";
            readiness: "ready" | "ready_with_warnings" | "not_ready" | "checking" | "unknown";
            score: {
                placementMeasured?: boolean;
                value: number;
                grade: "excellent" | "good" | "fair" | "poor" | "critical";
                confidence: "high" | "medium" | "low";
                components: {
                    placement: {
                        score: number;
                        weight: number;
                        basis: string;
                    };
                    authentication: {
                        score: number;
                        weight: number;
                        basis: string;
                    };
                    reputation: {
                        score: number;
                        weight: number;
                        basis: string;
                    };
                    content: {
                        score: number;
                        weight: number;
                        basis: string;
                    };
                    posture: {
                        score: number;
                        weight: number;
                        basis: string;
                    };
                };
                trend: {
                    direction: "up" | "down" | "flat";
                    previousScore: number;
                    previousComputedAt: string;
                } | null;
            };
            authentication: {
                spf: "verified" | "pending" | "failed" | "missing";
                dkim: "verified" | "pending" | "failed" | "missing";
                dmarc: "verified" | "pending" | "missing";
            };
            tracking: {
                linksStatus?: "live" | "no_cert" | "unreachable" | "unknown";
                openTracking?: boolean;
                clickTracking?: boolean;
            };
            warmup: {
                sendId: string;
                currentTranche?: number;
                sentSoFar?: number;
                pausedAt?: string;
                pauseReason?: string;
                rampEndsAt?: string;
            }[];
            dailyVolume: {
                day: string;
                sent: number;
            }[];
            domainActivity: {
                sampled: true;
                sampleSendCount: number;
                sentCount: number;
                deliveredCount: number;
                bouncedCount: number;
                complainedCount: number;
                bounceRate: number | null;
                complaintRate: number | null;
            } | null;
            orgReputation: {
                scope: "org";
                totalSent: number;
                bounceRate: number | null;
                complaintRate: number | null;
            } | null;
            recentPlacementTests: {
                testId: string;
                emailId: string;
                status: "queued" | "running" | "completed" | "partially_completed" | "failed";
                phase?: "sending" | "collecting";
                overall: {
                    total: number;
                    inbox: number;
                    spam: number;
                    missing: number;
                    pending: number;
                } | null;
                authentication: {
                    spf?: string;
                    dkim?: string;
                    dmarc?: string;
                } | null;
                spamFilterFlagged: boolean;
                source?: string;
                variant?: string;
                createdAt: string;
            }[];
            signals: {
                id: "domain_not_verified" | "dns_record_failed" | "dmarc_missing" | "dmarc_invalid" | "sending_disabled" | "tracking_links_broken" | "high_bounce_rate" | "high_complaint_rate" | "placement_spam_heavy" | "content_spam_filter_flagged" | "auth_failing_in_tests" | "placement_baseline_spam" | "content_image_weight_penalty" | "content_promotional_penalty" | "content_promotions_tab_shift" | "warmup_paused" | "org_reputation_restricted";
                severity: "critical" | "warning" | "info";
                summary: string;
                suggestion: string;
                action?: {
                    tool: string;
                    note?: string;
                };
            }[];
            checkedAt: string;
            scoreHistory?: {
                score: number;
                grade: "excellent" | "good" | "fair" | "poor" | "critical";
                confidence: "high" | "medium" | "low";
                trigger: "placement_test" | "domain_verified" | "domain_score_run" | "health_read";
                computedAt: string;
                components: {
                    placement: {
                        score: number;
                        weight: number;
                    };
                    authentication: {
                        score: number;
                        weight: number;
                    };
                    reputation: {
                        score: number;
                        weight: number;
                    };
                    content: {
                        score: number;
                        weight: number;
                    };
                    posture: {
                        score: number;
                        weight: number;
                    };
                };
            }[];
            scoreRuns?: {
                runId: string;
                trigger: "domain_verified" | "manual";
                status: "queued" | "running" | "completed" | "partially_completed" | "failed";
                phase?: "preparing" | "collecting";
                scoreAfter: {
                    score: number;
                    grade: "excellent" | "good" | "fair" | "poor" | "critical";
                } | null;
                creditsCharged: number;
                variants: {
                    variant: "plain_text" | "text_forward" | "balanced" | "image_heavy" | "promotional";
                    status?: "queued" | "running" | "completed" | "partially_completed" | "failed";
                    phase?: "sending" | "collecting";
                    testId?: string;
                    emailId?: string;
                    overall?: {
                        total: number;
                        inbox: number;
                        spam: number;
                        missing: number;
                        pending: number;
                    };
                }[];
                errorMessage?: string;
                createdAt: string;
                updatedAt: string;
            }[];
        };
        TemplatesListResponse: {
            data: {
                emailId: string;
                title: string;
                category?: string;
                brand?: string;
                html: string;
                previewImage: string;
                updatedAt: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        FlowsListResponse: {
            data: {
                slug: string;
                brand: {
                    name: string;
                    logo?: string;
                };
                title: string;
                type: "newsletter" | "signup";
                kind?: "onboarding" | "trial" | "events" | "product_updates" | "promotions";
                category: string;
                categoryLabel: string;
                emailCount: number;
                spanDays: number;
                remixCount: number;
                previewImages: string[];
                publishedAt: string;
                updatedAt: string;
                anchor?: "submittedAt" | "signedUpAt" | "verifiedAt" | "firstEmail";
                steps?: {
                    order: number;
                    dayOffset: number;
                    delayDays: number;
                    subject: string;
                    previewText?: string;
                    category: string;
                    categoryLabel: string;
                    emailId: string;
                    previewImage?: string;
                    html?: string;
                }[];
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
            total: number;
            isTotalExact: boolean;
        };
        BrandGetResponse: {
            brandId: string;
            domain: string;
            status: "extracting" | "completed" | "failed" | "deleting";
            ready: boolean;
            progress?: number;
            phase?: string;
            error?: string;
            createdAt?: string;
            updatedAt?: string;
            identity: {
                brandName?: string;
                description?: string;
                tagline?: string;
                contactEmail?: string;
                contactPhone?: string;
                address?: string;
                socialLinks?: unknown[];
                contentLinks?: unknown[];
            } & {
                [key: string]: unknown;
            };
            emailDesign?: string;
            imageStyle?: string;
            logos?: {
                src: string;
                type?: string;
                theme?: string;
                format?: string;
                background?: string;
                width?: number;
                height?: number;
                size?: number;
            }[];
        };
        BrandPatchRequest: {
            identity?: {
                brandName?: string;
                description?: string;
                tagline?: string;
                contactEmail?: string;
                contactPhone?: string;
                address?: string;
            };
            emailDesign?: string;
            imageStyle?: string;
        };
        BrandImagesResponse: {
            data: {
                assetId: string;
                kind: "logo" | "brand" | "generated";
                url: string;
                description?: string;
                width?: number;
                height?: number;
                category?: string;
                pageUrl?: string;
                addedAt?: string;
                logo?: {
                    type?: string;
                    theme?: string;
                    background?: string;
                    format?: string;
                };
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        BrandImageDeleteResponse: {
            assetId: string;
            deleted: boolean;
        };
        BrandsListResponse: {
            data: {
                brandId: string;
                domain: string;
                status: "extracting" | "completed" | "failed" | "deleting";
                ready: boolean;
                progress?: number;
                phase?: string;
                error?: string;
                createdAt?: string;
                updatedAt?: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        BrandsCreateResponse: {
            brandId: string;
            domain: string;
            status: "extracting" | "completed" | "failed" | "deleting";
            ready: boolean;
            progress?: number;
            phase?: string;
            error?: string;
            createdAt?: string;
            updatedAt?: string;
            extraction: {
                chatId: string;
                statusUrl: string;
            };
        };
        BrandsCreateRequest: {
            url: string;
            instructions?: string;
            includePaths?: string[];
            excludePaths?: string[];
            excludeSubdomains?: string[];
        };
        BrandGetByIdResponse: {
            brandId: string;
            domain: string;
            status: "extracting" | "completed" | "failed" | "deleting";
            ready: boolean;
            progress?: number;
            phase?: string;
            error?: string;
            createdAt?: string;
            updatedAt?: string;
        };
        ContentImageResponse: {
            url: string;
            prompt: string;
            description?: string;
            warnings?: string[];
        };
        ContentGenerateImageRequest: {
            prompt?: string;
            mode?: "text-to-image" | "image-editing";
            aspectRatio?: "16:9" | "3:2" | "4:3" | "1:1" | "4:5" | "2:3" | "3:4" | "9:16";
            image1?: string;
            image2?: string;
            adCreative?: {
                brandName: string;
                headline: string;
                cta: string;
                format: "1:1" | "4:5" | "9:16" | "16:9";
                archetype: "product-ui-card" | "mascot" | "flat-illustration" | "abstract-brand" | "type-led" | "photo-ui-overlay" | "conceptual-3d" | "gradient-field" | "editorial-photo" | "collage" | "isometric-blueprint" | "data-viz";
                layout?: "split-right" | "split-left" | "stacked-center" | "visual-first" | "type-poster" | "immersive-field" | "layered-collage" | "badge-offer" | "diagonal-stage" | "editorial-grid";
                eyebrow?: string;
                subjectImageUrl?: string;
                emailCanvasColor?: string;
                typeface?: {
                    family: string;
                    register?: string;
                };
                palette: {
                    background: string;
                    accent: string;
                    headlineColor: string;
                };
                supportingVisual?: string;
                subhead?: string;
            };
        };
        ContentGifResponse: {
            gifUrl: string;
            altText?: string;
            duration?: number;
            fps?: number;
            frameCount?: number;
            aspectRatio?: string;
            width?: number;
            height?: number;
            loop?: boolean;
        };
        ContentGifRequest: {
            from: "prompt";
            prompt: string;
            frameCount?: number;
            fps?: number;
            aspectRatio?: "16:9" | "9:16" | "1:1";
            loop?: boolean;
        } | {
            from: "image";
            imageUrl: string;
            prompt?: string;
            frameCount?: number;
            fps?: number;
            aspectRatio?: "16:9" | "9:16" | "1:1";
            loop?: boolean;
        } | {
            from: "video";
            videoUrl: string;
            fps?: number;
            width?: number;
        };
        ContentTransformResponse: {
            url: string;
            width: number;
            height: number;
            aspectRatio?: string;
            bytes?: number;
            fallbackUsed?: boolean;
        };
        ContentTransformRequest: {
            operation: "optimize";
            imageUrl: string;
        } | {
            operation: "resize";
            imageUrl: string;
            width: number;
            height: number;
            prompt?: string;
            resolution?: "1K" | "2K" | "4K";
            outputFormat?: "png" | "jpeg" | "webp";
        } | {
            operation: "remove_background";
            imageUrl: string;
        };
        ContentPngResponse: {
            url: string;
            width: number;
        };
        ContentHtmlToPngRequest: {
            html: string;
            width?: number;
            maxHeight?: number;
        };
        ContentAddImageResponse: {
            url: string;
            width: number;
            height: number;
            aspectRatio: string;
            assetId: string;
        };
        ContentAddImageBatchResponse: {
            accepted: number;
            skipped: number;
            runId?: string;
        };
        ContentAddImageRequest: {
            imageUrl: string;
        } | {
            imageUrls: string[];
        } | {
            uploadId: string;
        };
        ContentImageUploadCreateResponse: {
            uploadId: string;
            uploadUrl: string;
            expiresAt: string;
            maxBytes: number;
        };
        ContentImageUploadCreateRequest: {
            fileName: string;
            contentType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/avif" | "image/tiff" | "image/svg+xml";
            size: number;
        };
        UsageGetResponse: {
            plan: {
                key: string;
                name: string;
            };
            credits: {
                limit: number | null;
                used: number;
                remaining: number | null;
                reserved?: number;
            };
            emailSends: {
                limit: number | null;
                used: number;
                remaining: number | null;
                reserved?: number;
            };
            onDemand: {
                active: boolean;
                capUsd: number | null;
                budgetUsd: number;
                spentUsd: number;
                creditsRemaining: number;
                emailSendsRemaining: number;
            };
            period: {
                start: string | null;
                end: string | null;
            };
        };
        IntegrationsListResponse: {
            data: {
                provider: "braze" | "brevo" | "clerk" | "customerio" | "figma" | "framer" | "slack" | "hubspot" | "typeform" | "klaviyo" | "iterable" | "postmark" | "onesignal" | "mailgun" | "sendgrid" | "mailjet" | "mailchimp" | "loops" | "stripe" | "stytch" | "supabase" | "workos" | "shopify" | "revenuecat" | "notion" | "posthog" | "webflow" | "campaignmonitor";
                name: string;
                category: "data_in" | "data_out";
                connected: boolean;
                comingSoon?: true;
                inviteOnly?: true;
                paused?: true;
                installationCount?: number;
                capabilities?: {
                    capabilityId: string;
                    isReady: boolean;
                }[];
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        IntegrationEventsListResponse: {
            data: {
                eventId: string;
                provider: string;
                sourceId: string;
                eventKey: string;
                title: string;
                label?: string;
                kind: "standard" | "custom" | "action" | "derived" | "observed";
                category?: string;
                stage?: "signup" | "activation" | "engagement" | "conversion" | "retention" | "churn_risk" | "none";
                modelRoles: ("signup" | "activation" | "conversion" | "key_event")[];
                volume30d?: number;
                lastSeenAt?: string;
                triggerEventId?: string;
            }[];
            sources: {
                sourceId: string;
                provider: string;
                mode: "static_catalog" | "tenant_catalog";
                definitionCount: number;
                isTruncated: boolean;
                lastSyncedAt?: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        IntegrationEventDetailResponse: {
            eventId: string;
            provider: string;
            sourceId: string;
            eventKey: string;
            title: string;
            label?: string;
            kind: "standard" | "custom" | "action" | "derived" | "observed";
            category?: string;
            stage?: "signup" | "activation" | "engagement" | "conversion" | "retention" | "churn_risk" | "none";
            modelRoles: ("signup" | "activation" | "conversion" | "key_event")[];
            volume30d?: number;
            lastSeenAt?: string;
            triggerEventId?: string;
            description?: string;
            derivedFromKey?: string;
            properties: {
                key: string;
                variable: string;
                scope: "event" | "person";
                type: string;
                description?: string;
                isPersonal: boolean;
                isPersonalization: boolean;
            }[];
            propertiesStatus: "current" | "stored" | "rate_limited" | "unavailable";
            retryAfterSeconds?: number;
        };
        ApiKeysListResponse: {
            data: {
                keyId: string;
                name: string;
                keyPreview: string;
                createdAt: string;
                lastUsedAt?: string;
                status: "active" | "revoked";
                brandId?: string;
                permissions: string[];
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        ApiKeysCreateResponse: {
            key: string;
            keyId: string;
            message: string;
        };
        ApiKeysCreateRequest: {
            name?: string;
            permissions?: ("all" | "contacts" | "emails" | "automations" | "transactional" | "domains" | "sends" | "audiences" | "brands")[];
            brandId?: string;
            replacesKeyId?: string;
        };
        ApiKeysDeleteResponse: {
            keyId: string;
            deleted: boolean;
            revokedAt?: string;
        };
        HealthResponse: {
            status: "ok";
            version: string;
        };
        HelpResponse: {
            [key: string]: unknown;
        };
        ChatList: {
            data: {
                chatId: string;
                title: string | null;
                firstUserPrompt: string | null;
                lastAssistantPreview: string | null;
                status: "idle" | "streaming" | "background_finalizing" | "completed" | "failed" | "interrupted" | "stopped" | "persistence_failed" | null;
                origin: "slack" | "teams" | "google-chat" | "telegram" | null;
                updatedAt: string;
                url: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        NotificationList: {
            data: {
                notificationId: string;
                type: "webhook_attention" | "chat_stream" | "import_job" | "brand_image_import" | "validation_job" | "email_sent" | "email_scheduled" | "preview_email" | "brand_extracted" | "domain_status" | "domain_score_run" | "api_key_created" | "email_send_failed" | "gradual_send_paused" | "gradual_send_completed" | "send_limit_reached" | "trial_ending" | "trial_expired" | "payment_failed" | "automation_pause_window_closed" | "send_review_rejected" | "comment_mention" | "comment_reply" | "integration_attention";
                status: "uploading" | "preparing" | "processing" | "finalizing" | "streaming" | "background_finalizing" | "completed" | "partial" | "failed" | "interrupted" | "stopped" | "persistence_failed";
                title: string;
                subtitle: string;
                progressPercent?: number;
                url?: string;
                chatId?: string;
                emailId?: string;
                domainId?: string;
                domainName?: string;
                isPersonal: boolean;
                createdAt: string;
                updatedAt: string;
                completedAt?: string;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
        EmailCommentThreadList: {
            data: {
                commentId: string;
                emailId: string;
                status: "open";
                target: {
                    kind: "email";
                } | {
                    kind: "element";
                    elementId?: string;
                    nodeType?: string;
                };
                participants: {
                    userId: string;
                    name: string;
                }[];
                participantCount: number;
                messageCount: number;
                lastMessageAt: string;
                lastMessagePreview: string;
                url: string;
                messages?: {
                    messageId: string;
                    author: {
                        userId: string;
                        name: string;
                    };
                    body: string;
                    mentions: {
                        userId: string;
                        name: string;
                    }[];
                    createdAt: string;
                    updatedAt: string;
                }[];
                messagesCursor?: string | null;
            }[];
            pagination: {
                limit: number;
                cursor: string | null;
                hasMore: boolean;
            };
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listWebhooks: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Webhook"][];
                        pagination: {
                            limit: number;
                            cursor: string | null;
                            hasMore: boolean;
                        };
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createWebhook: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    endpoint: string;
                    events: ("email.sent" | "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained" | "email.failed" | "email.opened" | "email.clicked")[];
                    description?: string;
                };
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        endpoint: string;
                        events: ("email.sent" | "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained" | "email.failed" | "email.opened" | "email.clicked")[];
                        description: string;
                        status: "enabled" | "disabled";
                        created_at: string;
                        signing_secret: string;
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getWebhook: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                webhookId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Webhook"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    deleteWebhook: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                webhookId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        webhookId: string;
                        deleted: boolean;
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    updateWebhook: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                webhookId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    endpoint?: string;
                    events?: ("email.sent" | "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained" | "email.failed" | "email.opened" | "email.clicked")[];
                    description?: string;
                    status?: "enabled" | "disabled";
                };
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Webhook"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    rotateWebhookSecret: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                webhookId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        signing_secret: string;
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listWebhookEvents: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                webhookId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            id: string;
                            payload: {
                                type: "email.sent";
                                created_at: string;
                                data: {
                                    email_id: string;
                                    created_at: string;
                                    from?: string;
                                    to: string[];
                                    subject?: string;
                                    tags?: {
                                        [key: string]: string;
                                    };
                                    brew: {
                                        event_id: string;
                                        schema_version: 1;
                                        recipient?: string;
                                        send_id?: string;
                                        design_id?: string;
                                        automation_id?: string;
                                        provider_message_id?: string;
                                        test?: true;
                                    };
                                };
                            } | {
                                type: "email.delivered";
                                created_at: string;
                                data: {
                                    email_id: string;
                                    created_at: string;
                                    from?: string;
                                    to: string[];
                                    subject?: string;
                                    tags?: {
                                        [key: string]: string;
                                    };
                                    brew: {
                                        event_id: string;
                                        schema_version: 1;
                                        recipient?: string;
                                        send_id?: string;
                                        design_id?: string;
                                        automation_id?: string;
                                        provider_message_id?: string;
                                        test?: true;
                                    };
                                };
                            } | {
                                type: "email.delivery_delayed";
                                created_at: string;
                                data: {
                                    email_id: string;
                                    created_at: string;
                                    from?: string;
                                    to: string[];
                                    subject?: string;
                                    tags?: {
                                        [key: string]: string;
                                    };
                                    brew: {
                                        event_id: string;
                                        schema_version: 1;
                                        recipient?: string;
                                        send_id?: string;
                                        design_id?: string;
                                        automation_id?: string;
                                        provider_message_id?: string;
                                        test?: true;
                                    };
                                };
                            } | {
                                type: "email.complained";
                                created_at: string;
                                data: {
                                    email_id: string;
                                    created_at: string;
                                    from?: string;
                                    to: string[];
                                    subject?: string;
                                    tags?: {
                                        [key: string]: string;
                                    };
                                    brew: {
                                        event_id: string;
                                        schema_version: 1;
                                        recipient?: string;
                                        send_id?: string;
                                        design_id?: string;
                                        automation_id?: string;
                                        provider_message_id?: string;
                                        test?: true;
                                    };
                                };
                            } | {
                                type: "email.bounced";
                                created_at: string;
                                data: {
                                    email_id: string;
                                    created_at: string;
                                    from?: string;
                                    to: string[];
                                    subject?: string;
                                    tags?: {
                                        [key: string]: string;
                                    };
                                    brew: {
                                        event_id: string;
                                        schema_version: 1;
                                        recipient?: string;
                                        send_id?: string;
                                        design_id?: string;
                                        automation_id?: string;
                                        provider_message_id?: string;
                                        test?: true;
                                    };
                                    bounce?: {
                                        type: string;
                                        subType?: string;
                                        message?: string;
                                        diagnosticCode?: string[];
                                    };
                                };
                            } | {
                                type: "email.failed";
                                created_at: string;
                                data: {
                                    email_id: string;
                                    created_at: string;
                                    from?: string;
                                    to: string[];
                                    subject?: string;
                                    tags?: {
                                        [key: string]: string;
                                    };
                                    brew: {
                                        event_id: string;
                                        schema_version: 1;
                                        recipient?: string;
                                        send_id?: string;
                                        design_id?: string;
                                        automation_id?: string;
                                        provider_message_id?: string;
                                        test?: true;
                                    };
                                    failed?: {
                                        reason: string;
                                    };
                                };
                            } | {
                                type: "email.opened";
                                created_at: string;
                                data: {
                                    email_id: string;
                                    created_at: string;
                                    from?: string;
                                    to: string[];
                                    subject?: string;
                                    tags?: {
                                        [key: string]: string;
                                    };
                                    brew: {
                                        event_id: string;
                                        schema_version: 1;
                                        recipient?: string;
                                        send_id?: string;
                                        design_id?: string;
                                        automation_id?: string;
                                        provider_message_id?: string;
                                        test?: true;
                                    };
                                    open?: {
                                        timestamp?: string;
                                        ipAddress?: string;
                                        userAgent?: string;
                                    };
                                };
                            } | {
                                type: "email.clicked";
                                created_at: string;
                                data: {
                                    email_id: string;
                                    created_at: string;
                                    from?: string;
                                    to: string[];
                                    subject?: string;
                                    tags?: {
                                        [key: string]: string;
                                    };
                                    brew: {
                                        event_id: string;
                                        schema_version: 1;
                                        recipient?: string;
                                        send_id?: string;
                                        design_id?: string;
                                        automation_id?: string;
                                        provider_message_id?: string;
                                        test?: true;
                                    };
                                    click?: {
                                        link: string;
                                        timestamp?: string;
                                        ipAddress?: string;
                                        userAgent?: string;
                                    };
                                };
                            } | null;
                            status: "succeeded" | "pending" | "failed" | "sending" | "canceled";
                            created_at: string;
                            next_attempt_at: string | null;
                        }[];
                        pagination: {
                            limit: number;
                            cursor: string | null;
                            hasMore: boolean;
                        };
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listWebhookAttempts: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                webhookId: string;
                eventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            id: string;
                            event_id: string;
                            status: "succeeded" | "pending" | "failed" | "sending" | "canceled";
                            response_status: number;
                            response: string;
                            duration_ms: number;
                            created_at: string;
                        }[];
                        pagination: {
                            limit: number;
                            cursor: string | null;
                            hasMore: boolean;
                        };
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    replayWebhookEvent: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                webhookId: string;
                eventId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            202: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        accepted: true;
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    testWebhook: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                webhookId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    type: "email.sent" | "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained" | "email.failed" | "email.opened" | "email.clicked";
                };
            };
        };
        responses: {
            202: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        accepted: true;
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listEmails: {
        parameters: {
            query?: {
                search?: string;
                status?: "generating" | "ready" | "failed";
                groupId?: string;
                sortBy?: "updatedAt" | "createdAt";
                from?: string;
                to?: string;
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    generateEmail: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailGenerateRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailGenerateTextResponse"];
                };
            };
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailGenerateGeneratedResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            502: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getEmail: {
        parameters: {
            query?: {
                include?: string;
                emailVersionId?: string;
                runId?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailDetail"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    deleteEmail: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailsDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    editEmail: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailEditRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailGenerateResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            502: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    importEmail: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailImportRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailImportResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            502: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    importFigmaDesign: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FigmaToEmailRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FigmaToEmailResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    importEmailImage: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ImageToEmailRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImageToEmailResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    cloneEmail: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["EmailCloneRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailGenerateGeneratedResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    restoreEmailVersion: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailRestoreRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailGenerateGeneratedResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    exportEmailDesign: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailExportRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailExportResponse"];
                };
            };
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailExportResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            502: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    auditEmail: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailAuditRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "X-Credit-Cost": number;
                    "X-Credits-Remaining": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailAuditResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    previewEmailAcrossClients: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailClientPreviewRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        previewId: string;
                        emailId: string;
                        emailVersionId?: string;
                        status: "queued" | "running" | "completed" | "partially_completed" | "failed";
                        previews: {
                            id: string;
                            label: string;
                            category: "gmail" | "outlook" | "apple" | "yahoo" | "other";
                            os: string;
                            dark: boolean;
                            status: "running" | "completed" | "failed";
                            imageUrl: string | null;
                            reason?: "pending" | "upstream_unavailable" | "unsupported_client" | "render_failed" | "rehost_failed" | "expired" | "submission_unknown" | "authorization_changed" | "snapshot_unavailable";
                            retryable: boolean;
                        }[];
                        pending: string[];
                        createdAt: string;
                        expiresAt: string;
                        nextPollAfterMs: number;
                        credits: {
                            cost: number;
                            status: "reserved" | "settled" | "released";
                        };
                    };
                };
            };
            202: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailClientPreviewResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listInboxPlacementTests: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailInboxPlacementTestList"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createInboxPlacementTest: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailInboxPlacementRequest"];
            };
        };
        responses: {
            202: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailInboxPlacementTest"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getInboxPlacementTest: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
                testId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailInboxPlacementTest"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getEmailAudit: {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                auditId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        schemaVersion: 1;
                        rulesetVersion: string;
                        auditId: string;
                        contentHash: string;
                        auditedAt: string;
                        expiresAt: string;
                        policy: {
                            purpose: "marketing" | "transactional" | "unknown";
                            source: "provided" | "defaulted" | "trusted_adapter" | "inferred";
                            confidence?: number;
                            unsubscribe: "required" | "not_required" | "not_evaluated";
                        };
                        summary: {
                            blockers: number;
                            errors: number;
                            warnings: number;
                            info: number;
                            total: number;
                        };
                        checks: ({
                            id: string;
                            status: "passed";
                            durationMs: number;
                            findingCount: 0;
                        } | {
                            id: string;
                            status: "issues";
                            durationMs: number;
                            findingCount: number;
                        } | {
                            id: string;
                            status: "not_applicable";
                            reason: "no_remote_links" | "no_remote_images" | "no_remote_assets" | "missing_copy" | "requires_sending_domain" | "send_transport_owned" | "requires_audience_context" | "separate_deliverability_test" | "transactional_purpose" | "unknown_purpose";
                        } | {
                            id: string;
                            status: "unavailable";
                            reason: "timeout" | "upstream" | "invalid_response";
                            retryable: boolean;
                            durationMs: number;
                        })[];
                        metrics: {
                            htmlBytes: number;
                            linkCount: number;
                            imageCount: number;
                            gifCount: number;
                            loadedSize: {
                                status: "exact";
                                htmlBytes: number;
                                remoteAssetBytes: number;
                                totalBytes: number;
                                assetCount: number;
                            } | {
                                status: "lower_bound";
                                htmlBytes: number;
                                knownRemoteAssetBytes: number;
                                knownTotalBytes: number;
                                unknownAssetCount: number;
                            };
                        };
                        findings: {
                            id: string;
                            ruleId: string;
                            category: "compliance" | "links" | "images" | "accessibility" | "compatibility" | "copy" | "size" | "markup";
                            severity: "blocker" | "error" | "warning" | "info";
                            impact: "block" | "confirm" | "advisory";
                            message: string;
                            remediation: string;
                            occurrenceCount?: number;
                            sources: string[];
                            standards?: {
                                id: string;
                                url?: string;
                            }[];
                            evidence?: {
                                kind: "http";
                                status: number | null;
                                failure?: "dns" | "tls" | "connect" | "timeout" | "private_host" | "redirects";
                            } | {
                                kind: "clients";
                                unsupported: string[];
                            } | {
                                kind: "judgment";
                                question: string;
                                probability: number;
                            };
                            target: {
                                kind: "email";
                            } | {
                                kind: "subject";
                            } | {
                                kind: "preview_text";
                            } | {
                                kind: "link";
                                index: number;
                                displayUrl: string;
                            } | {
                                kind: "image";
                                index: number;
                                displayUrl: string;
                            } | {
                                kind: "element";
                                selector: string;
                            };
                        }[];
                        totalFindings: number;
                        findingsTruncated: boolean;
                        completion: {
                            status: "complete";
                            readiness: "ready" | "needs_review" | "not_ready";
                            score: number;
                        } | {
                            status: "partial";
                            readiness: "unknown" | "not_ready";
                            score: null;
                        };
                        pagination: {
                            cursor: string | null;
                            hasMore: boolean;
                            returned: number;
                            storedFindings: number;
                        };
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getEmailRendering: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                previewId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        previewId: string;
                        emailId: string;
                        emailVersionId?: string;
                        status: "queued" | "running" | "completed" | "partially_completed" | "failed";
                        previews: {
                            id: string;
                            label: string;
                            category: "gmail" | "outlook" | "apple" | "yahoo" | "other";
                            os: string;
                            dark: boolean;
                            status: "running" | "completed" | "failed";
                            imageUrl: string | null;
                            reason?: "pending" | "upstream_unavailable" | "unsupported_client" | "render_failed" | "rehost_failed" | "expired" | "submission_unknown" | "authorization_changed" | "snapshot_unavailable";
                            retryable: boolean;
                        }[];
                        pending: string[];
                        createdAt: string;
                        expiresAt: string;
                        nextPollAfterMs: number;
                        credits: {
                            cost: number;
                            status: "reserved" | "settled" | "released";
                        };
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createCanvasSession: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    target: {
                        type: "group";
                        groupId: string;
                    } | {
                        type: "email";
                        emailId: string;
                    };
                    user: {
                        externalId: string;
                        name: string;
                    };
                    parentOrigin: string;
                    permissions?: ("read" | "edit" | "presence")[];
                };
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CanvasSession"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    refreshCanvasSession: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CanvasSession"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    revokeCanvasSession: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        revoked: true;
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listEmailGroups: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailGroupsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createEmailGroup: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailGroupCreateRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailGroupWriteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getEmailGroup: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                groupId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailGroupSummary"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    deleteEmailGroup: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                groupId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailGroupDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    updateEmailGroup: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                groupId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailGroupPatchRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailGroupWriteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listSends: {
        parameters: {
            query?: {
                emailId?: string;
                kind?: "campaign" | "automation";
                automationId?: string;
                automationRunId?: string;
                audienceRunId?: string;
                triggerInstanceId?: string;
                status?: "scheduled" | "queued" | "running" | "paused" | "completed" | "partially_completed" | "failed" | "canceled";
                messageClass?: "marketing" | "transactional";
                from?: string;
                to?: string;
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SendsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createSend: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SendEmailRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SendEmailTestResponse"];
                };
            };
            202: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SendsPostResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getSend: {
        parameters: {
            query?: {
                include?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                sendId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Send"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    cancelSend: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                sendId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SendCancelResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    pauseSend: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                sendId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SendPauseResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    resumeSend: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                sendId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SendResumeResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getAnalyticsOverview: {
        parameters: {
            query?: {
                from?: string;
                to?: string;
                source?: string;
                automationId?: string;
                emailId?: string;
                audienceId?: string;
                triggerEventId?: string;
                domain?: string;
                recipient?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnalyticsOverviewResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getAutomationAnalytics: {
        parameters: {
            query?: {
                from?: string;
                to?: string;
                automationId?: string;
                limit?: number;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationAnalyticsResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getEventsAnalytics: {
        parameters: {
            query?: {
                from?: string;
                to?: string;
                recipient?: string;
                eventType?: "sent" | "delivered" | "delivery_delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "provider_suppressed" | "suppressed" | "quota_skipped" | "received" | "unsubscribed" | "automation_started" | "automation_completed" | "automation_failed" | "automation_skipped_suppressed" | "automation_step_succeeded" | "automation_step_failed" | "trigger_success" | "trigger_failure" | "trigger_received" | "trigger_deduplicated" | "trigger_signature_failed" | "trigger_rejected" | "trigger_dead_letter";
                automationId?: string;
                sendId?: string;
                automationRunId?: string;
                messageClass?: "marketing" | "transactional";
                source?: string;
                audienceId?: string;
                emailId?: string;
                domain?: string;
                triggerEventId?: string;
                includeMachineClicks?: boolean;
                includeMachineOpens?: boolean;
                limit?: number;
                cursor?: string;
                groupBy?: string;
                bucket?: "day" | "week" | "month";
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventsAnalyticsSuccessResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listAutomations: {
        parameters: {
            query?: {
                search?: string;
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createAutomation: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AutomationsPostRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationDryRunReport"];
                };
            };
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRow"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getAutomation: {
        parameters: {
            query?: {
                include?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                automationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRow"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    deleteAutomation: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                automationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationsDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    updateAutomation: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                automationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AutomationsUpdateRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRow"] | components["schemas"]["AutomationDryRunReport"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    testAutomation: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                automationId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["AutomationTestRequest"];
            };
        };
        responses: {
            202: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRunStartedResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    runAutomation: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                automationId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["AutomationRunRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRunDryRunResponse"];
                };
            };
            202: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudienceAutomationRunStartedResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listAudienceRuns: {
        parameters: {
            query?: {
                automationId?: string;
                status?: "queued" | "scheduled" | "running" | "paused" | "completed" | "failed" | "canceled";
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudienceRunsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getAudienceRun: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                audienceRunId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudienceRun"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    pauseAudienceRun: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                audienceRunId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudienceRunActionResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    resumeAudienceRun: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                audienceRunId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudienceRunActionResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    cancelAudienceRun: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                audienceRunId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudienceRunActionResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listAutomationRuns: {
        parameters: {
            query?: {
                automationId?: string;
                triggerEventId?: string;
                triggerInstanceId?: string;
                recipientEmail?: string;
                status?: "queued" | "running" | "completed" | "failed" | "canceled";
                mode?: "live" | "test";
                from?: string;
                to?: string;
                limit?: number | string;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRunsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getAutomationRun: {
        parameters: {
            query?: {
                include?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                automationRunId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRun"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    cancelAutomationRun: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                automationRunId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["AutomationRunCancelRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutomationRunCancelResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    ensureBrewEventTrigger: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BrewEventTriggersPostRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrewEventTriggerSaved"];
                };
            };
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrewEventTriggerSaved"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    ensureIntegrationEventTrigger: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IntegrationEventTriggersPostRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationEventTriggerSaved"];
                };
            };
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationEventTriggerSaved"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listTriggers: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TriggersListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createTrigger: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TriggersPostRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TriggerRow"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getTrigger: {
        parameters: {
            query?: {
                include?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                triggerEventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TriggerRow"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    deleteTrigger: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                triggerEventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TriggersDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    updateTrigger: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                triggerEventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TriggersPatchRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TriggerRow"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    checkTriggerReady: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                triggerEventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TriggerReadiness"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    fireTrigger: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                triggerEventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TriggerFireRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TriggerFireAccepted"];
                };
            };
            202: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TriggerFireAccepted"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getTriggerContract: {
        parameters: {
            query?: {
                format?: "json" | "ts" | "zod" | "jsonschema" | "skill";
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                triggerEventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayloadContractGetResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    setTriggerContract: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                triggerEventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PayloadContractPutRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayloadContractPutResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    validateTriggerPayload: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                triggerEventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PayloadContractValidateRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayloadContractValidateResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    inferPayloadContract: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PayloadContractInferRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayloadContractInferResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listTriggerInstances: {
        parameters: {
            query?: {
                triggerEventId?: string;
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TriggerInstancesListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getTriggerInstance: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                triggerInstanceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TriggerInstance"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listContacts: {
        parameters: {
            query?: {
                search?: string;
                audienceId?: string;
                sort?: string;
                order?: "asc" | "desc";
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    upsertContacts: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContactsPostRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsPostBatchResponse"];
                };
            };
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsPostSingleResponse"];
                };
            };
            207: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsPostBatchResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getContact: {
        parameters: {
            query?: {
                include?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                email: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactWithOpenProfile"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    deleteContact: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                email: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    updateContact: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                email: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContactsPatchRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsPatchResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    searchContacts: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContactsSearchRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsSearchSuccessResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    validateContacts: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContactsValidateRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsValidateResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    importContactsCsv: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContactsImportCsvRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsImportResponse"];
                };
            };
            207: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsImportResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    importContacts: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContactsImportRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsImportResponse"];
                };
            };
            207: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsImportResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    batchDeleteContacts: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContactsBatchDeleteRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsBatchDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listContactFields: {
        parameters: {
            query?: {
                include?: "coverage";
                audienceId?: string;
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FieldsGetResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createContactField: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FieldsPostRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactFieldDefinition"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getContactField: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                fieldName: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactFieldDefinition"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    deleteContactField: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                fieldName: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FieldsDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listAudiences: {
        parameters: {
            query?: {
                search?: string;
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudiencesListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createAudience: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AudiencesPostRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudienceWriteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getAudience: {
        parameters: {
            query?: {
                include?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                audienceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Audience"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    deleteAudience: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                audienceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudiencesDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    updateAudience: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                audienceId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AudiencesPatchRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudienceWriteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createAudienceFromEvents: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AudiencesFromEventsRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudiencesFromEventsResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    duplicateAudience: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                audienceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Audience"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listDomains: {
        parameters: {
            query?: {
                sendableOnly?: "true" | "false";
                sendingPurpose?: "marketing" | "transactional";
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    addDomain: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DomainsPostRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Domain"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getDomain: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                domainId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Domain"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    deleteDomain: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                domainId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainsDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    updateDomain: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                domainId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DomainsPatchRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Domain"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    verifyDomain: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                domainId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Domain"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listDomainUnsubscribes: {
        parameters: {
            query?: {
                q?: string;
                scope?: "any" | "domain" | "all";
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                domainId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainUnsubscribesListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    addDomainUnsubscribes: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                domainId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DomainUnsubscribesAddRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainUnsubscribesAddResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    removeDomainUnsubscribe: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                domainId: string;
                email: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainUnsubscribeRemoveResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    importDomainUnsubscribes: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path: {
                domainId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DomainUnsubscribesImportRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainUnsubscribesImportResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    exportDomainUnsubscribes: {
        parameters: {
            query?: {
                scope?: "any" | "domain" | "all";
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                domainId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainUnsubscribesExportResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getDomainHealth: {
        parameters: {
            query?: {
                include?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                domainId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainHealth"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listTemplates: {
        parameters: {
            query?: {
                brand?: string;
                category?: string;
                group?: "welcome-onboarding" | "newsletter" | "content" | "events" | "product-news" | "sales" | "retention" | "company" | "transactional" | "internal" | "other";
                semantic?: string;
                query?: string;
                representation?: "full" | "summary";
                count?: boolean | ("true" | "false");
                groupBy?: "brand" | "category" | "group";
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplatesListResponse"] | {
                        data: {
                            emailId: string;
                            title: string;
                            category?: string;
                            brand?: string;
                            previewImage: string;
                            updatedAt: string;
                            referenceEmailId: string;
                            viewUrl: string;
                        }[];
                        pagination: {
                            limit: number;
                            cursor: string | null;
                            hasMore: boolean;
                        };
                    } | {
                        count: number;
                        groupBy?: "brand" | "category" | "group";
                        groups?: {
                            value: string;
                            name?: string;
                            count: number;
                        }[];
                        groupCount?: number;
                        ungroupedCount?: number;
                        pagination?: {
                            limit: number;
                            cursor: string | null;
                            hasMore: boolean;
                        };
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getTemplate: {
        parameters: {
            query?: {
                include?: "html";
            };
            header?: never;
            path: {
                templateId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        emailId: string;
                        title: string;
                        category?: string;
                        brand?: string;
                        previewImage: string;
                        updatedAt: string;
                        referenceEmailId: string;
                        viewUrl: string;
                        templateId: string;
                        html?: string;
                        content?: {
                            url: string;
                            mimeType: "text/html";
                            bytes: number;
                        };
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listFlows: {
        parameters: {
            query?: {
                brand?: string;
                category?: "verification" | "transactional" | "direct_sales" | "welcome" | "promotion" | "newsletter" | "education" | "abandoned_cart" | "winback" | "other";
                type?: "newsletter" | "signup";
                kind?: "onboarding" | "trial" | "events" | "product_updates" | "promotions";
                semantic?: string;
                sort?: "newest" | "emails" | "span" | "remixes";
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FlowsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getFlow: {
        parameters: {
            query?: {
                kind?: string;
                include?: string;
            };
            header?: never;
            path: {
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Flow"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getBrand: {
        parameters: {
            query?: {
                include?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrandGetResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    updateBrand: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BrandPatchRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrandGetResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getBrandImages: {
        parameters: {
            query?: {
                q?: string;
                kind?: "logo" | "brand" | "generated";
                sort?: "newest" | "oldest";
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrandImagesResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    deleteBrandImage: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                assetId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrandImageDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listBrands: {
        parameters: {
            query?: {
                status?: "extracting" | "completed" | "failed" | "deleting";
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrandsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createBrand: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BrandsCreateRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrandsCreateResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getBrandById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                brandId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrandGetByIdResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    generateImage: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContentGenerateImageRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContentImageResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createGif: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContentGifRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContentGifResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    transformImage: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContentTransformRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContentTransformResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    htmlToPng: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContentHtmlToPngRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContentPngResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            402: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    addImage: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContentAddImageRequest"];
            };
        };
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContentAddImageResponse"];
                };
            };
            202: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContentAddImageBatchResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            409: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            413: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            422: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createImageUpload: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContentImageUploadCreateRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContentImageUploadCreateResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getUsage: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsageGetResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listIntegrations: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listIntegrationEvents: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
                provider?: string;
                query?: string;
                kind?: "standard" | "custom" | "action" | "derived" | "observed";
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationEventsListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    describeIntegrationEvent: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                eventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntegrationEventDetailResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listApiKeys: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiKeysListResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    createApiKey: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApiKeysCreateRequest"];
            };
        };
        responses: {
            201: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiKeysCreateResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    revokeApiKey: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                keyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiKeysDeleteResponse"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    getHelp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HelpResponse"];
                };
            };
        };
    };
    listChats: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChatList"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getChatContext: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                chatId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        chatId: string;
                        title: string | null;
                        modelId: string | null;
                        updatedAt: string | null;
                        messageCount: number;
                        artifacts: {
                            type: "email" | "automation";
                            id: string;
                            title: string;
                            imageUrl?: string;
                        }[];
                        triggerEventIds: string[];
                        recentMessages: {
                            role: "user" | "assistant" | "system";
                            text: string;
                        }[];
                    };
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            503: {
                headers: {
                    "x-request-id": string;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listInsights: {
        parameters: {
            query?: {
                state?: "open" | "all";
                severity?: "critical" | "warning" | "opportunity" | "info";
                include?: string;
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InsightList"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    getInsight: {
        parameters: {
            query?: never;
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                insightId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Insight"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listNotifications: {
        parameters: {
            query?: {
                type?: "webhook_attention" | "chat_stream" | "import_job" | "brand_image_import" | "validation_job" | "email_sent" | "email_scheduled" | "preview_email" | "brand_extracted" | "domain_status" | "domain_score_run" | "api_key_created" | "email_send_failed" | "gradual_send_paused" | "gradual_send_completed" | "send_limit_reached" | "trial_ending" | "trial_expired" | "payment_failed" | "automation_pause_window_closed" | "send_review_rejected" | "comment_mention" | "comment_reply" | "integration_attention";
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationList"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
    listEmailComments: {
        parameters: {
            query?: {
                include?: string;
                commentId?: string;
                messagesCursor?: string;
                limit?: number;
                cursor?: string;
            };
            header?: {
                "X-Brand-Id"?: string;
            };
            path: {
                emailId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailCommentThreadList"];
                };
            };
            400: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            401: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            403: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            404: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            429: {
                headers: {
                    "x-request-id": string;
                    "X-RateLimit-Limit": number;
                    "X-RateLimit-Remaining": number;
                    "X-RateLimit-Reset": number;
                    "Retry-After": number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
            500: {
                headers: {
                    "x-request-id": string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorEnvelope"];
                };
            };
        };
    };
}
