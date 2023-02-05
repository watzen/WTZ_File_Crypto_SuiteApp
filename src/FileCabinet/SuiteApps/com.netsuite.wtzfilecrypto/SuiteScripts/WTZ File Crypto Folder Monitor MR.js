/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/file','./WTZ File Crypto Constants.js'],
    /**
     *
     * @param record
     * @param search
     * @param file
     * @param CONSTANTS
     * @return {{getInputData: getInputData, summarize: summarize, map: map}}
     */
    (record, search,file,CONSTANTS) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */
        const getInputData = (inputContext) => {

            let setupRecordsSearch = search.create({
                type: "customrecord_wtz_file_crypto_job_setup",
                filters:
                    [
                        ["custrecord_wtz_file_crypto_s_inpt_fldr","isnotempty",""],
                        "AND",
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        "internalid",
                        "custrecord_wtz_file_crypto_s_inpt_fldr"
                    ]
            });
            let searchResultCount = setupRecordsSearch.runPaged().count;
            log.debug("setupRecordsSearch result count",searchResultCount);

            let output = [];

            setupRecordsSearch.run().each(function(jobresult){
                let fileSearch = search.create({
                    type: "file",
                    filters: [["folder","anyof",jobresult.getValue({name:'custrecord_wtz_file_crypto_s_inpt_fldr'})]],
                    columns: ["internalid"]
                });
                let searchResultCount = fileSearch.runPaged().count;
                log.debug("fileSearchObj result count",searchResultCount);
                fileSearch.run().each(function(result){
                    output.push({jobSetupRecord: jobresult.id, fileId:result.getValue({name:'internalid'})});
                    return true;
                });
                return true;
            });
            return output;
        }

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */
        const map = (mapContext) => {
            try {
                let key = JSON.parse(mapContext.key);
                let mapValue = JSON.parse(mapContext.value);

                log.debug('key:',key);
                log.debug('mapValue:',JSON.stringify(mapValue));

                if (key !== -1) {

                    let queueSearchObj = search.create({
                        type: "customrecord_wtz_file_crypto_queue",
                        filters: [
                            ["custrecord_wtz_file_crypto_q_inputfile",search.Operator.ANYOF,mapValue.fileId],
                            "AND",
                            ["isinactive",search.Operator.IS,'F'],
                        ],
                        columns: ['internalid']
                    });
                    let queueSearchResultCount = queueSearchObj.runPaged().count;
                    log.debug('queueSearchResultCount:'+queueSearchResultCount);

                    //Only put it in the queue if the file isn't already queued
                    if(!queueSearchResultCount) {
                        log.debug('creating queue record for fileId:'+mapValue.fileId);
                        let queueRec = record.create({
                            type:'customrecord_wtz_file_crypto_queue'
                        });
                        queueRec.setValue({
                            fieldId: 'custrecord_wtz_file_crypto_q_setup_rec',
                            value: mapValue.jobSetupRecord
                        });
                        queueRec.setValue({
                            fieldId: 'custrecord_wtz_file_crypto_q_inputfile',
                            value: mapValue.fileId
                        });

                        queueRec.setValue({
                            fieldId: 'custrecord_wtz_file_crypto_q_status',
                            value: CONSTANTS.PROCESSING_STATUSES.PENDING
                        });
                        queueRec.save();
                    }
                    else {log.debug('Queue records already exists for fileId:'+mapValue.fileId+'. No queue-record created.')}
                }
            }
            catch (e) {
                log.error("e", e);
                log.error("e.stack", e.stack);
            }
        }

        const summarize = (summaryContext) => {

        }

        return { getInputData, map, summarize }

    });
