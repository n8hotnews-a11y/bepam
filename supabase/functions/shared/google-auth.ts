import { importPKCS8, SignJWT } from 'https://deno.land/x/jose@v4.15.5/index.ts';

export async function getAccessToken(serviceAccountJson: any) {
    try {
        const { client_email, private_key } = serviceAccountJson;

        // PEM private key from JSON
        const algorithm = 'RS256';
        const ecPrivateKey = await importPKCS8(private_key, algorithm);

        // Create JWT
        const jwt = await new SignJWT({
            scope: 'https://www.googleapis.com/auth/cloud-platform'
        })
            .setProtectedHeader({ alg: algorithm })
            .setIssuer(client_email)
            .setAudience('https://oauth2.googleapis.com/token')
            .setExpirationTime('1h')
            .setIssuedAt()
            .sign(ecPrivateKey);

        // Exchange for Access Token
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt,
            }),
        });

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw error;
    }
}
