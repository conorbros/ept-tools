import proj4 from 'proj4';
const fetch = require('node-fetch');

/**
 * Attempts to get the proj4 string for an SRS code from spacialreference.org
 * @param {string} srsCode 
 */
export async function getSRSCodeProj4String(srsCode) {
    const [code, number] = srsCode.split(':');
    const url = `https://spatialreference.org/ref/${code.toLowerCase()}/${number}/proj4/`;
    return fetch(url)
        .then(response => response.text())
        .then(body => {
            proj4.defs[srsCode] = body;
        })
        .catch(error => {})
}

export default proj4