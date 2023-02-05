/**
 * @NApiVersion 2.1
 */
define([],

    () => {

        return {

                APPLICATION_ID: 'com.netsuite.wtzfilecrypto',
                PROCESSING_FOLDER_NAME: 'Files in process',
                RECORD_TYPES: {
                        QUEUE_REC: {
                                ID: 'customrecord_wtz_file_crypto_queue',
                                FIELDS: {
                                        PROCESS_STATUS: 'custrecord_wtz_file_crypto_q_status',
                                }
                        },
                },
                PROCESSING_STATUSES: {
                        PENDING: 'Pending',
                        PROCESSING: 'Processing',
                        ERROR: 'Error',
                        COMPLETE: 'Complete',
                },
                PROCESSING_SCRIPT: {
                        SCRIPT: 'customscript_wtz_file_crypto_job_mr',
                        DEPLOYMENT: 'customdeploy_wtz_file_crypto_job_mr',
                },
        }

});
