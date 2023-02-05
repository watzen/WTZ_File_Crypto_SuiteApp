/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/auth', 'N/log', 'N/record', 'N/runtime', 'N/task'],
    /**
     *
     * @param auth
     * @param log
     * @param record
     * @param runtime
     * @param task
     * @return {{onAction: (function({newRecord: Record, oldRecord: Record, workflowId: string, type: string, form: Form}): *)}}
     */
    (auth, log, record, runtime, task) => {

        const paramToRecordObject = {
            custscript_wtz_file_crypto_job_setup: 'custrecord_wtz_file_crypto_q_setup_rec',
            custscript_wtz_file_crypto_input_file_id: 'custrecord_wtz_file_crypto_q_inputfile'
        };

        /**
         *
         * @param paramToRecordObject
         * @return {{}}
         */
        const getScriptParameters = (paramToRecordObject) => {
            let scriptObj = runtime.getCurrentScript();
            let paramObject = {}
            for(let prop in paramToRecordObject) {
                if(paramToRecordObject.hasOwnProperty(prop)){
                    paramObject[prop] = {
                        fieldId: paramToRecordObject[prop],
                        value: scriptObj.getParameter({name:prop})
                    };
                }
            }
            return paramObject;
        }

        /**
         * Defines the WorkflowAction script trigger point.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.workflowId - Internal ID of workflow which triggered this action
         * @param {string} scriptContext.type - Event type
         * @param {Form} scriptContext.form - Current form that the script uses to interact with the record
         * @since 2016.1
         */
        const onAction = (scriptContext) => {

            log.debug('Start');
            let t1 = new Date().getTime();

            let paramsObject = getScriptParameters(paramToRecordObject);
            log.debug('paramObject:',JSON.stringify(paramsObject));

            let wtzFileCryptoQueueRec = record.create({
                type: 'customrecord_wtz_file_crypto_queue'
            });
            for(let prop in paramsObject){
                wtzFileCryptoQueueRec.setValue({
                    fieldId: paramsObject[prop].fieldId,
                    value: paramsObject[prop].value
                });
            }
            wtzFileCryptoQueueRec = wtzFileCryptoQueueRec.save();
            log.debug('Created queue record ID:',JSON.stringify(wtzFileCryptoQueueRec));

            //create the scriptTask if it isn't already scheduled

            log.debug('End','time to complete execution:'+((new Date().getTime()-t1)/1000)+'s');
            return wtzFileCryptoQueueRec;
        }

        return {onAction};
    });
