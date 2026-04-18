-- Mark old plain-text messages clearly to avoid confusion with failed E2EE messages
UPDATE messages 
SET message = '[Message sent before encryption was enabled]'
WHERE nonce IS NULL 
AND type IN ('private', 'group')
AND message NOT LIKE '%[Message sent%';
