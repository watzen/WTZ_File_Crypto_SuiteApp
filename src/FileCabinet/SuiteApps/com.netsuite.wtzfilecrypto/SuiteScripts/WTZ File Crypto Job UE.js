/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/task', 'N/search', './WTZ File Crypto Constants.js'],
    /**
     *
     * @param record
     * @param task
     * @param search
     * @param CONSTANTS
     * @return { afterSubmit: afterSubmit}
     */
    (record,task, search, CONSTANTS) => {

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} context
         * @param {Record} context.newRecord - New record
         * @param {Record} context.oldRecord - Old record
         * @param {string} context.type - Trigger type; use values from the context.UserEventType enum
         * @param {string[]} context.UserEventType - context type enums
         * @since 2015.2
         */
        const afterSubmit = (context) => {
            log.debug('start', context)
            const startTime = new Date().getTime()
            const newRec = context.newRecord
            const QUEUE_REC = CONSTANTS.RECORD_TYPES.QUEUE_REC
            let processStatus
            try {
                if (context.type === context.UserEventType.XEDIT) {
                    processStatus = search.lookupFields({
                        type: QUEUE_REC.ID,
                        id: context.newRecord.id,
                        columns: QUEUE_REC.FIELDS.PROCESS_STATUS,
                    })[QUEUE_REC.FIELDS.PROCESS_STATUS]
                    log.debug('xedit processStatus', processStatus)
                }
                else {
                    processStatus = newRec.getValue({ fieldId:QUEUE_REC.FIELDS.PROCESS_STATUS })
                }
                if (processStatus !== CONSTANTS.PROCESSING_STATUSES.PENDING) {
                    return
                }
                const mrTask = task.create({ taskType: task.TaskType.MAP_REDUCE })
                mrTask.scriptId = CONSTANTS.PROCESSING_SCRIPT.SCRIPT
                mrTask.deploymentId = CONSTANTS.PROCESSING_SCRIPT.DEPLOYMENT
                mrTask.submit()
                log.audit({ title:'rescheduleScript', details: 'Created task for processing records' })
            } catch (e) {
                if (e.name !== 'MAP_REDUCE_ALREADY_RUNNING') {
                    log.error({ title: 'error in submitting task', details: e })
                }
            }
            log.audit({ title:'attemptScheduleOfMRScriptAfterRecordSubmit complete', details: { recordId: newRec.id, millisecondsToExecute: (new Date().getTime()-startTime) } })
        }

        return { afterSubmit: afterSubmit }
})
