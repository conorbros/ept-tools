import proj4 from 'proj4';
const fetch = require('node-fetch');

/**
 * Attempts to get the proj4 string for an SRS code from spacialreference.org
 * @param {string} srsCode 
 */
export async function getSRSCodeProj4String(srsCode) {
    const splitCode = srsCode.split(':');
    const url = `https://spatialreference.org/ref/${splitCode[0].toLowerCase()}/${splitCode[1]}/proj4/`;
    console.log(url);
    return fetch(url)
        .then(response => response.text())
        .then(body => {
            proj4.defs[srsCode] = body;
        })
        .catch(error => {})
}

export default proj4