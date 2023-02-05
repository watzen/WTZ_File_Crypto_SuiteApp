# WTZ_File_Crypto_SuiteApp
A proof of concept for Encrypting and Decrypting files using OpenPGP in Netsuite with the OpenPGP.js library.
Beware, there are many flaws in the design. 
* No restart of processing M/R script if more queue records are created while it is still processing the first batch
* Keys are stored in plain-text (maybe they could be encrypted using NS-encryption functions and a key stored in the API Secrets that is bundled.
* ...more



## There are three Custom record types:
### WTZ File Crypto Types
A list of different types of encryption, the idea was to be able to expand with other forms of encryptions.

### WTZ File Crypto Job Setup
In these records you setup rules for handling files in the file cabinet. What type of encryption and keys for it

### WTZ File Crypto Queue
This record will keep track of the en-/decryption tasks that are pending 





## There are three main scripts
### WTZ File Crypto Folder Monitor MR
Monitors the input folders according to the "WTZ File Crypto Job Setup"-records and creates queue-records for files in the folders.

### WTZ File Crypto Queue UE
On afterSubmit it will try to submit a Map/reduce task if the record has the status "Pending"

### WTZ File Crypto Job MR
This will process all queue-records that has the status "Pending"

## Suggested file structure:

![folderstruct](https://user-images.githubusercontent.com/613420/216850057-f215dfc4-ab87-4d0f-983b-9fac9414752e.png)
