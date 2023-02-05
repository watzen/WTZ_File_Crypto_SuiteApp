/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/file', 'N/log', 'N/record', 'N/runtime', 'N/search','N/cache','./WTZ File Crypto Constants.js', './lib/shim.js', './lib/openpgp.js', './lib/byte-base64.js'],
    /**
     *
     * @param file
     * @param log
     * @param record
     * @param runtime
     * @param search
     * @param cache
     * @param CONSTANTS
     * @param shim
     * @param openpgp
     * @param bytebase64
     * @return {{reduce: reduce, getInputData: (function(*): *), summarize: summarize, map: map}}
     */
    (file, log, record, runtime, search,cache,CONSTANTS, shim, openpgp, bytebase64) => {


        /*
        Copyright (c) 2011, Daniel Guerrero
        All rights reserved.
        Redistribution and use in source and binary forms, with or without
        modification, are permitted provided that the following conditions are met:
            * Redistributions of source code must retain the above copyright
              notice, this list of conditions and the following disclaimer.
            * Redistributions in binary form must reproduce the above copyright
              notice, this list of conditions and the following disclaimer in the
              documentation and/or other materials provided with the distribution.
        THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
        ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
        WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
        DISCLAIMED. IN NO EVENT SHALL DANIEL GUERRERO BE LIABLE FOR ANY
        DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
        (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
        LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
        ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
        (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
        SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
         */

        /**
         * Uses the new array typed in javascript to binary base64 encode/decode
         * at the moment just decodes a binary base64 encoded
         * into either an ArrayBuffer (decodeArrayBuffer)
         * or into an Uint8Array (decode)
         *
         * References:
         * https://developer.mozilla.org/en/JavaScript_typed_arrays/ArrayBuffer
         * https://developer.mozilla.org/en/JavaScript_typed_arrays/Uint8Array
         */

        var Base64Binary = {
            _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

            /* will return a  Uint8Array type */
            decodeArrayBuffer: function(input) {
                var bytes = (input.length/4) * 3;
                var ab = new ArrayBuffer(bytes);
                this.decode(input, ab);

                return ab;
            },

            removePaddingChars: function(input){
                var lkey = this._keyStr.indexOf(input.charAt(input.length - 1));
                if(lkey == 64){
                    return input.substring(0,input.length - 1);
                }
                return input;
            },

            decode: function (input, arrayBuffer) {
                //get last chars to see if are valid
                input = this.removePaddingChars(input);
                input = this.removePaddingChars(input);

                var bytes = parseInt((input.length / 4) * 3, 10);

                var uarray;
                var chr1, chr2, chr3;
                var enc1, enc2, enc3, enc4;
                var i = 0;
                var j = 0;

                if (arrayBuffer)
                    uarray = new Uint8Array(arrayBuffer);
                else
                    uarray = new Uint8Array(bytes);

                input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

                for (i=0; i<bytes; i+=3) {
                    //get the 3 octects in 4 ascii chars
                    enc1 = this._keyStr.indexOf(input.charAt(j++));
                    enc2 = this._keyStr.indexOf(input.charAt(j++));
                    enc3 = this._keyStr.indexOf(input.charAt(j++));
                    enc4 = this._keyStr.indexOf(input.charAt(j++));

                    chr1 = (enc1 << 2) | (enc2 >> 4);
                    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                    chr3 = ((enc3 & 3) << 6) | enc4;

                    uarray[i] = chr1;
                    if (enc3 != 64) uarray[i+1] = chr2;
                    if (enc4 != 64) uarray[i+2] = chr3;
                }

                return uarray;
            }
        }

        async function encryptPGP({ publicKeyArmored, inputFileContents, isText }) {
            let t1 = new Date().getTime();
            await log.debug('encryptPGP', '- start -');

            await log.debug("publicKeyArmored",publicKeyArmored);

            let t2 = new Date().getTime();
            const {data: encrypted} = await openpgp.encrypt({
                message: isText ? openpgp.message.fromText(inputFileContents) : openpgp.message.fromBinary(inputFileContents),
                publicKeys: (await openpgp.key.readArmored(publicKeyArmored)).keys, // for encryption
                //privateKeys: [privateKey],                                        // for signing (optional)
                //format: 'binary',
            });
            log.audit('time to encrypt: ' + ((new Date().getTime() - t2) / 1000).toFixed(2) + 's');
            log.debug('encrypted message', encrypted); // '-----BEGIN PGP MESSAGE ... END PGP MESSAGE-----'

            log.audit({
                title: 'encryptPGP',
                details: 'end. time to encrypt: ' + ((new Date().getTime() - t1) / 1000).toFixed(2) + 's'
            });

            return encrypted;
        }

        async function decryptPGP({ privateKeyArmored, passphrase, inputFileContents }) {
            let t1 = new Date().getTime();
            await log.debug('decryptPGP', '- start -');

            let t2 = new Date().getTime();
            const {keys: [privateKey]} = await openpgp.key.readArmored(privateKeyArmored);
            await privateKey.decrypt(passphrase);
            log.audit('time to decrypt the private key: ' + ((new Date().getTime() - t2) / 1000).toFixed(2) + 's');

            t2 = new Date().getTime();
            const {data: decrypted} = await openpgp.decrypt({
                message: await openpgp.message.readArmored(inputFileContents),              // parse armored message
                //publicKeys: (await openpgp.key.readArmored(publicKeyArmored)).keys,       // for verification (optional)
                privateKeys: [privateKey],                                                  // for decryption
                format: 'binary',
            });
            log.audit('time to decrypt: ' + ((new Date().getTime() - t2) / 1000).toFixed(2) + 's');
            log.debug('decrypt message', decrypted); // '-----BEGIN PGP MESSAGE ... END PGP MESSAGE-----'
            log.audit({
                title: 'decryptPGP',
                details: 'end. time to decrypt: ' + ((new Date().getTime() - t1) / 1000).toFixed(2) + 's'
            });

            return decrypted;
        }

        /**
         *
         * @param processingObj
         * @return {Promise<void>}
         */
        async function mainAsyncExecution(processingObj) {
            log.debug('mainAsyncExecution - start -', processingObj);

            const inputFile = file.load({id: processingObj.custrecord_wtz_file_crypto_q_inputfile.value}); //10 units
            const cryptoType = record.load({
                type: 'customrecord_wtz_file_crypto_types',
                id: processingObj["custrecord_wtz_file_crypto_setup_type.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC"].value
            }); //2 units
            await Promise.all([inputFile, cryptoType]); //wait for the two inputFileContents and cryptoType loads to complete
            log.debug('input file...', { isText: inputFile.isText })
            const inputFileContents = inputFile.isText ? inputFile.getContents() : Base64Binary.decode(inputFile.getContents());
            log.debug('inputFileContents',inputFileContents)

            const cryptoTypeName = cryptoType.getValue('scriptid')
            const custrecord_wtz_file_crypto_s_encrypt = processingObj["custrecord_wtz_file_crypto_s_encrypt.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC"] === 'T'
            const outputFolderId = processingObj["custrecord_wtz_file_crypto_s_outpt_fldr.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC"]
            const shouldKeepOriginalFile = processingObj["custrecord_wtz_file_crypto_s_copy_orig.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC"] === 'T'
            const processedFolderId = processingObj["custrecord_wtz_file_crypto_s_cpy_org_fld.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC"]
            log.debug({
                title: 'important values',
                details: {
                    cryptoTypeName,
                    custrecord_wtz_file_crypto_s_encrypt,
                    outputFolderId,
                    shouldKeepOriginalFile,
                    processedFolderId,
                },
            })
            let newFileId;

            if (cryptoTypeName === 'pgp') {

                if(custrecord_wtz_file_crypto_s_encrypt){
                    let encryptedContents = await encryptPGP({
                        publicKeyArmored: processingObj["custrecord_wtz_file_crypto_setup_epubkey.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC"],
                        inputFileContents,
                        isText: inputFile.isText,
                    })

                    const newFile = file.create({
                        name: inputFile.name+'.pgp',
                        fileType: file.Type.PLAINTEXT,
                        contents: encryptedContents,
                        folder: outputFolderId,
                    })
                    newFileId = newFile.save();
                    log.debug('mainAsyncExecution', 'new encrypted fileId:' + newFileId);
                }
                else if(!custrecord_wtz_file_crypto_s_encrypt) {
                    let newFileName
                    if (inputFile.name.slice(-4) === ".pgp") {
                        newFileName = inputFile.name.slice(0, -4);
                    } else {
                        newFileName = 'decrypted-' + inputFile.name;
                    }

                    let tmpFile = file.create({
                        name: newFileName,
                        fileType: file.Type.PLAINTEXT,
                        contents: 'asdasd',
                        folder: outputFolderId,
                    })
                    const tmpFileId = tmpFile.save()

                    tmpFile =  file.load({ id: tmpFileId })
                    const newFileType = tmpFile.fileType
                    const targetFileIsText = tmpFile.isText
                    file.delete({ id: tmpFileId })

                    log.debug('new file info', { newFileType, targetFileIsText })

                    let decryptedContents = await decryptPGP({
                        privateKeyArmored: processingObj['custrecord_wtz_file_crypto_setup_privkey.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'],
                        passphrase: processingObj['custrecord_wtz_file_crypto_priv_key_pass.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'],
                        inputFileContents,
                    })

                    let convertedContent = ''

                    if(targetFileIsText) {
                        const encodedString = String.fromCharCode.apply(null, decryptedContents)
                        convertedContent = '\uFEFF' + decodeURIComponent(escape(encodedString))
                    } else {
                        convertedContent = bytebase64.bytesToBase64(decryptedContents)
                        //convertedContent = new TextDecoder().decode(decryptedContents)
                    }

                    log.debug('convertedContent', convertedContent)

                    const newFile = file.create({
                        name: newFileName,
                        fileType: newFileType,
                        contents: convertedContent,
                        folder: outputFolderId,
                    })

                    newFileId = newFile.save();
                    log.debug('mainAsyncExecution', 'new decrypted fileId:' + newFileId);
                }

            }

            if(shouldKeepOriginalFile) {
                inputFile.folder = processedFolderId
                inputFile.save()
            } else {
                file.delete({ id: inputFile.id })
            }

            return newFileId
        }

        /**
         *
         * @param name
         * @param parentId
         * @return {number}
         */
        const getFolderWithParent = (name, parentId = false) => {

            let parentFilter = parentId ? parentId : "@NONE@";

            let folderSearch = search.create({
                type: record.Type.FOLDER,
                filters: [
                    ['name','is',name],
                    "AND",
                    ["parent","anyof",parentFilter]
                ],
                columns: [
                    'internalid'
                ]
            });
            let folderId = Number();
            folderSearch.run().each(function(result){
                folderId = parseFloat(result.id);
                return true;
            });

            return folderId;
        }

        const getProcessingFolder = () => {

            //TODO use N/cache to store the folderID

            let suiteAppFolderId = getFolderWithParent('SuiteApps');
            let applicationFolderId = getFolderWithParent(CONSTANTS.APPLICATION_ID,suiteAppFolderId);
            let processingFolderId = getFolderWithParent(CONSTANTS.PROCESSING_FOLDER_NAME,applicationFolderId);

            if(!processingFolderId) {
                let processingFolder = record.create({type: record.Type.FOLDER});
                processingFolder.setValue({fieldId:'name',value:CONSTANTS.PROCESSING_FOLDER_NAME});
                processingFolder.setValue({fieldId:'parent',value:applicationFolderId});
                processingFolderId = processingFolder.save();
            }

            return processingFolderId;

        }

        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */
        //Searches for queue-records and passes them to map-stage
        const getInputData = () => {

                let queueSearchObj;

                try {
                    let columnsData = {
                        custrecord_wtz_file_crypto_q_setup_rec: {name: 'custrecord_wtz_file_crypto_q_setup_rec'},
                        custrecord_wtz_file_crypto_q_inputfile: {name: 'custrecord_wtz_file_crypto_q_inputfile'},
                        custrecord_wtz_file_crypto_setup_privkey: {name: 'custrecord_wtz_file_crypto_setup_privkey', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                        custrecord_wtz_file_crypto_setup_dpubkey: {name: 'custrecord_wtz_file_crypto_setup_dpubkey', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                        custrecord_wtz_file_crypto_s_encrypt: {name: 'custrecord_wtz_file_crypto_s_encrypt', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                        custrecord_wtz_file_crypto_setup_epubkey: {name: 'custrecord_wtz_file_crypto_setup_epubkey', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                        custrecord_wtz_file_crypto_setup_type: {name: 'custrecord_wtz_file_crypto_setup_type', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                        custrecord_wtz_file_crypto_s_outpt_fldr: {name: 'custrecord_wtz_file_crypto_s_outpt_fldr', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                        custrecord_wtz_file_crypto_s_inpt_fldr: {name: 'custrecord_wtz_file_crypto_s_inpt_fldr', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                        custrecord_wtz_file_crypto_s_copy_orig: {name: 'custrecord_wtz_file_crypto_s_copy_orig', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                        custrecord_wtz_file_crypto_s_cpy_org_fld: {name: 'custrecord_wtz_file_crypto_s_cpy_org_fld', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                        custrecord_wtz_file_crypto_s_err_fld: {name: 'custrecord_wtz_file_crypto_s_err_fld', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                        custrecord_wtz_file_crypto_priv_key_pass: {name: 'custrecord_wtz_file_crypto_priv_key_pass', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'},
                    };
                    let columnsObj = [];
                    for (let col in columnsData) {
                        if (columnsData.hasOwnProperty(col)) columnsObj.push(search.createColumn(columnsData[col]))
                    }

                    queueSearchObj = search.create({
                        type: "customrecord_wtz_file_crypto_queue",
                        filters:
                            [
                                ["custrecord_wtz_file_crypto_q_status", "is", CONSTANTS.PROCESSING_STATUSES.PENDING]
                            ],
                        columns: columnsObj
                    });
                    let searchResultCount = queueSearchObj.runPaged().count;
                    log.debug("queueSearchObj result count",searchResultCount);
                }
                catch (e) {
                    log.error("e", e);
                    log.error("e.stack", e.stack);
                    throw e;
                }
                return queueSearchObj;
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
         * @param {function} mapContext.write - write out to the context for reduce or summary
         * @since 2015.2
         */
        //for each queue-record, update the status of it and move the file to an internal processing folder
        const map = (mapContext) => {
                log.debug('start map on key:' + JSON.parse(mapContext.key));

                let key;
                let value;

                try {
                    key = JSON.parse(mapContext.key);
                    value = JSON.parse(mapContext.value);

                    log.debug('key:', key);
                    log.debug('value:', JSON.stringify(value));

                    //TODO validate so that the file isn't too big. What is too big? 5mb?
                    let inputFile = file.load({
                        id: value.values.custrecord_wtz_file_crypto_q_inputfile.value
                    });
                    inputFile.folder = getProcessingFolder();
                    inputFile.save();

                    record.submitFields({
                        type: 'customrecord_wtz_file_crypto_queue',
                        id: value.id,
                        values: {'custrecord_wtz_file_crypto_q_status':  CONSTANTS.PROCESSING_STATUSES.PROCESSING}
                    });
                } catch (e) {
                    log.error("e", e);
                    log.error("e.stack", e.stack);
                    throw e;
                }

                log.debug('end map on key:' + JSON.parse(mapContext.key))
                mapContext.write({
                    key: key,
                    value: value
                });
            }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
            //for each queue-record, encrypt/decrypt and store the new file in its destination. Move or delete the original
        const reduce = (reduceContext) => {

                log.debug('start reduce on key:' + JSON.parse(reduceContext.key));
                try {

                    let key = reduceContext.key;
                    let values = JSON.parse(reduceContext.values[0]);

                    log.debug({ title: 'reduce key-values', details: { key, values } })

                    mainAsyncExecution(values.values)
                        .then(newFileId => {
                            log.audit({ title: 'complete mainAsyncFunction', details: { newFileId: newFileId } });

                            record.submitFields({
                                type: 'customrecord_wtz_file_crypto_queue',
                                id: values.id,
                                values: {
                                    custrecord_wtz_file_crypto_q_status: CONSTANTS.PROCESSING_STATUSES.COMPLETE,
                                    custrecord_wtz_file_crypto_q_proc_file: newFileId,
                                }
                            });
                        })
                        .catch(e => {
                            log.error("e", e);
                            log.error("e.stack", e.stack);
                            log.error("values.values.custrecord_wtz_file_crypto_q_inputfile.value",values.values.custrecord_wtz_file_crypto_q_inputfile.value);
                            log.error("values.values['custrecord_wtz_file_crypto_s_inpt_fldr.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC']",values.values["custrecord_wtz_file_crypto_s_inpt_fldr.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC"])
                            log.error("values.values['custrecord_wtz_file_crypto_s_err_fld.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC']", values.values["custrecord_wtz_file_crypto_s_err_fld.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC"])

                            record.submitFields({
                                type: 'customrecord_wtz_file_crypto_queue',
                                id: values.id,
                                values: {
                                    custrecord_wtz_file_crypto_q_status: CONSTANTS.PROCESSING_STATUSES.ERROR,
                                    custrecord_wtz_file_crypto_q_errormsg: e.toString(),
                                }
                            });
                            let fileObj = file.load({
                                id: values.values.custrecord_wtz_file_crypto_q_inputfile.value
                            });
                            fileObj.folder = values.values["custrecord_wtz_file_crypto_s_err_fld.CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC"];
                            fileObj.save();
                        });


                } catch (e) {
                    log.error('Error in reduce', 'e:' + e);
                    log.error('Error in reduce', 'e.stack:' + e.stack);
                    throw e;
                }

            }

        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} context - Statistics about the execution of a map/reduce script
         * @param {number} context.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} context.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} context.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} context.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} context.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} context.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} context.yields - Total number of yields when running the map/reduce script
         * @param {Object} context.inputSummary - Statistics about the input stage
         * @param {Object} context.mapSummary - Statistics about the map stage
         * @param {Object} context.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (context) => {

            context.reduceSummary.keys.iterator().each(function (key, executionCount, completionState){

                log.debug({
                    title: 'Reduce key ' + key,
                    details: 'Outcome for reduce key ' + key + ': ' + completionState + ' // Number of attempts used: ' + executionCount
                });

                return true;

            });


            context.reduceSummary.errors.iterator().each(function (key, error, executionNo){
                log.error({
                    title: 'Reduce error for key: ' + key + ', execution no. ' + executionNo,
                    details: error
                });
                record.submitFields({
                    type: CONSTANTS.RECORD_TYPES.QUEUE_REC.ID,
                    id: key,
                    values: {
                        [CONSTANTS.RECORD_TYPES.QUEUE_REC.FIELDS.PROCESS_STATUS]: 'Error',
                        custrecord_wtz_file_crypto_q_errormsg: error.toString(),
                    }
                })
                return true;
            });
        }

        return { getInputData, map, reduce, summarize }

    });
