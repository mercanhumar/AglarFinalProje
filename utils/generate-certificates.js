const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

// Generate a self-signed certificate
function generateCertificate() {
    // Generate a new key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);

    // Create a new certificate
    const cert = forge.pki.createCertificate();

    // Set certificate details
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    // Set certificate attributes
    const attrs = [{
        name: 'commonName',
        value: 'localhost'
    }, {
        name: 'countryName',
        value: 'US'
    }, {
        shortName: 'ST',
        value: 'California'
    }, {
        name: 'localityName',
        value: 'San Francisco'
    }, {
        name: 'organizationName',
        value: 'Test'
    }, {
        shortName: 'OU',
        value: 'Test'
    }];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Sign the certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // Convert to PEM format
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certificatePem = forge.pki.certificateToPem(cert);

    // Write files
    fs.writeFileSync('server.key', privateKeyPem);
    fs.writeFileSync('server.cert', certificatePem);

    console.log('Certificate and private key have been generated.');
}

generateCertificate();
