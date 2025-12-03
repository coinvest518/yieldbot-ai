const PINATA_API_KEY = import.meta.env.VITE_PINATA_KEY;
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET;

export const uploadToPinata = async (file: File | Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pinataMetadata', JSON.stringify({ name: 'NFTNinja Asset' }));
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 0 }));

  try {
    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: PINATA_API_KEY as string,
        pinata_secret_api_key: PINATA_SECRET_KEY as string,
      },
      body: formData,
    });

    if (!res.ok) throw new Error(`Pinata upload failed: ${res.statusText}`);
    const resData = await res.json();
    return resData.IpfsHash;
  } catch (error) {
    console.error('Error uploading file to Pinata:', error);
    throw error;
  }
};

export const uploadMetadataToPinata = async (metadataJSON: object): Promise<string> => {
  try {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: PINATA_API_KEY as string,
        pinata_secret_api_key: PINATA_SECRET_KEY as string,
      },
      body: JSON.stringify(metadataJSON),
    });

    if (!res.ok) throw new Error(`Pinata metadata upload failed: ${res.statusText}`);
    const resData = await res.json();
    return resData.IpfsHash;
  } catch (error) {
    console.error('Error uploading metadata to Pinata:', error);
    throw error;
  }
};

export const base64ToBlob = (base64: string, mimeType: string = 'image/png'): Blob => {
  const parts = base64.split(',');
  const bstr = atob(parts[parts.length - 1]);
  const ab = new ArrayBuffer(bstr.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < bstr.length; i++) {
    ia[i] = bstr.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
};
