/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log','N/runtime','N/file','N/search','N/record','./lib/shim.js','./lib/openpgp.js', './WTZ File Crypto Constants.js'],
    /**
     *
     * @param log
     * @param runtime
     * @param file
     * @param search
     * @param record
     * @param shim
     * @param openpgp
     * @param CONSTANTS
     * @return {{onRequest: onRequest}}
     */
    function (log, runtime,file,search,record, shim, openpgp, CONSTANTS){
        function wtzIsEmpty(a) { return void 0 == a ? !0 : null == a ? !0 : 0 == a.length ? !0 : "[object Object]" == Object.prototype.toString.call(a) && 0 == Object.keys(a).length ? !0 : !1 }

        const getJob = () => {
            log.debug('getJob','- start -');
            let t1 = new Date().getTime();

            let job = {};
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
                custrecord_wtz_file_crypto_priv_key_pass: {name: 'custrecord_wtz_file_crypto_priv_key_pass', join: 'CUSTRECORD_WTZ_FILE_CRYPTO_Q_SETUP_REC'}
            };
            let columnsObj = [];
            for (let col in columnsData) {
                if(columnsData.hasOwnProperty(col)) {
                    columnsObj.push(search.createColumn(columnsData[col]))
                }
            }
            let queueSearchObj = search.create({
                type: "customrecord_wtz_file_crypto_queue",
                filters:
                    [
                        ["custrecord_wtz_file_crypto_q_status","is",CONSTANTS.PROCESSING_STATUSES.PENDING]
                    ],
                columns: columnsObj
            });
            let searchResultCount = queueSearchObj.runPaged().count;
            log.debug("queueSearchObj result count",searchResultCount);
            let result = queueSearchObj.run().getRange({start:0,end:1})[0];
            if(result) {
                job.id = result.id;
                for (let column of columnsObj) {
                    job[column.name] = result.getValue(column);
                }
            }

            log.debug('job:',JSON.stringify(job));
            log.audit({title:'getJob', details:'time to get job: '+((new Date().getTime()-t1)/1000).toFixed(2)+'s'});
            return job;
        }

        async function encryptPGP(job,inputFileContents){
            let t1 = new Date().getTime();
            await log.debug('encryptPGP','- start -');

            const publicKeyArmored = job.custrecord_wtz_file_crypto_setup_epubkey;
            const privateKeyArmored = job.custrecord_wtz_file_crypto_setup_privkey;

            const passphrase = job.custrecord_wtz_file_crypto_priv_key_pass;

            /*
            let t2 = new Date().getTime();
            const { keys: [privateKey] } = await openpgp.key.readArmored(privateKeyArmored);
            await privateKey.decrypt(passphrase);
            log.audit('time to decrypt the private key: '+((new Date().getTime()-t2)/1000).toFixed(2)+'s');
             */

            t2 = new Date().getTime();
            const { data: encrypted } = await openpgp.encrypt({
                message: openpgp.message.fromText(inputFileContents),                         // input as Message object
                publicKeys: (await openpgp.key.readArmored(publicKeyArmored)).keys, // for encryption
                //privateKeys: [privateKey]                                           // for signing (optional)
            });
            log.audit('time to encrypt: '+((new Date().getTime()-t2)/1000).toFixed(2)+'s');
            log.debug('encrypted message',encrypted); // '-----BEGIN PGP MESSAGE ... END PGP MESSAGE-----'

            log.audit({title:'encryptPGP', details:'end. time to encrypt: '+((new Date().getTime()-t1)/1000).toFixed(2)+'s'});

            return encrypted;
        }

        async function decryptPGP(job,inputFileContents){
            let t1 = new Date().getTime();
            await log.debug('decryptPGP','- start -');

            //const publicKeyArmored = job.custrecord_wtz_file_crypto_setup_epubkey;
            const privateKeyArmored = job.custrecord_wtz_file_crypto_setup_privkey;
            const passphrase = job.custrecord_wtz_file_crypto_priv_key_pass;


            let t2 = new Date().getTime();
            const { keys: [privateKey] } = await openpgp.key.readArmored(privateKeyArmored);
            await privateKey.decrypt(passphrase);
            log.audit('time to decrypt the private key: '+((new Date().getTime()-t2)/1000).toFixed(2)+'s');


            t2 = new Date().getTime();
            const { data: decrypted } = await openpgp.decrypt({
                message: await openpgp.message.readArmored(inputFileContents),              // parse armored message
                //publicKeys: (await openpgp.key.readArmored(publicKeyArmored)).keys, // for verification (optional)
                privateKeys: [privateKey]                                           // for decryption
            });
            log.audit('time to decrypt: '+((new Date().getTime()-t2)/1000).toFixed(2)+'s');
            log.debug('decrypt message',decrypted); // '-----BEGIN PGP MESSAGE ... END PGP MESSAGE-----'

            log.audit({title:'decryptPGP', details:'end. time to decrypt: '+((new Date().getTime()-t1)/1000).toFixed(2)+'s'});

            return decrypted;
        }

        async function mainAsyncExecution(job){
            await log.debug('mainAsyncExecution','- start -');

            //main worker loop
            let newFileId

            if(!job.id) {
                await log.audit({ title: 'mainAsyncExecution', details: { message: 'no job supplied', job } })
            }
            await log.debug('mainAsyncExecution','inside while loop');
            await record.submitFields({
                type: 'customrecord_wtz_file_crypto_queue',
                id: job.id,
                values: {'custrecord_wtz_file_crypto_q_status':'Processing'}
            });

            const inputFile = file.load({id: job.custrecord_wtz_file_crypto_q_inputfile});
            const cryptoType = record.load({type: 'customrecord_wtz_file_crypto_types', id: job.custrecord_wtz_file_crypto_setup_type});
            await Promise.all([inputFile,cryptoType]); //wait for the two inputFileContents and cryptoType loads to complete
            const inputFileContents = await inputFile.getContents();

            let cryptoTypeName = cryptoType.getValue('scriptid')
            if (cryptoTypeName === 'pgp' && job.custrecord_wtz_file_crypto_s_encrypt) {

                    await log.debug('inside if: PGP & encrypt');
                    let encryptedContents = await encryptPGP(job,inputFileContents);
                    let newFile = await file.create({
                        name: inputFile.name+'.pgp',
                        fileType: file.Type.PLAINTEXT,
                        contents: encryptedContents,
                        folder: job.custrecord_wtz_file_crypto_s_outpt_fldr
                    });
                    newFileId = await newFile.save();
                    await log.debug('mainAsyncExecution','new encrypted fileId:'+newFileId);

            } else if (cryptoTypeName === 'pgp' && !job.custrecord_wtz_file_crypto_s_encrypt) {

                await log.debug('inside if: PGP & decrypt');
                let decryptedContents = await decryptPGP(job,inputFileContents);

                let newFileName = '';
                if (await inputFile.name.substr(-4,4) === ".pgp") newFileName = await inputFile.name.substr(0,inputFile.name.length-4);
                else newFileName = 'decrypted-' + inputFile.name;

                let newFile = await file.create({
                    name: newFileName,
                    fileType: file.Type.PLAINTEXT,
                    contents: decryptedContents,
                    folder: job.custrecord_wtz_file_crypto_s_outpt_fldr
                });
                newFileId = await newFile.save();
                await log.debug('mainAsyncExecution','new encrypted fileId:'+newFileId);

            }

            if(job.custrecord_wtz_file_crypto_s_copy_orig) {
                inputFile.folder = job.custrecord_wtz_file_crypto_s_cpy_org_fld
                inputFile.save()
            } else {
                file.delete({ id: inputFile.id })
            }

            return newFileId
        }

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        function onRequest(scriptContext){
            log.audit('start script');
            const job = getJob()
            mainAsyncExecution(job).then(function (newFileId) {
                log.audit('complete script','result', JSON.stringify(result));
                record.submitFields({
                    type: 'customrecord_wtz_file_crypto_queue',
                    id: job.id,
                    values: {
                        custrecord_wtz_file_crypto_q_status: 'Finished',
                        custrecord_wtz_file_crypto_q_proc_file: newFileId
                    }
                });
            })
                .catch(function (e) {
                    log.error("e", e);
                    log.error("e.stack", e.stack);
                    record.submitFields({
                        type: 'customrecord_wtz_file_crypto_queue',
                        id: job.id,
                        values: {
                            custrecord_wtz_file_crypto_q_status: 'Error',
                            custrecord_wtz_file_crypto_q_errormsg: e.toString(),
                        }
                    });
                });

        }
        return { onRequest: onRequest };
    });
