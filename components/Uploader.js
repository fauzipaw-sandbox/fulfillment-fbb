import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';

export default function Uploader({ onUploadOdpSuccess, onUploadOrderSuccess }) {
  const onDrop = useCallback(async (acceptedFiles, type) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();

    reader.onload = async () => {
      const text = reader.result;
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const endpoint = type === 'ODP' ? '/api/upload-odp' : '/api/upload-orders';
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: results.data }),
          });
          if (res.ok) alert('Upload sukses!');
          else alert('Gagal upload.');
          type === 'ODP' ? onUploadOdpSuccess() : onUploadOrderSuccess();
        }
      });
    };
    reader.readAsText(file);
  }, [onUploadOdpSuccess, onUploadOrderSuccess]);

  const { getRootProps: getOdpProps, getInputProps: getOdpInput } = useDropzone({ onDrop: (files) => onDrop(files, 'ODP') });
  const { getRootProps: getOrderProps, getInputProps: getOrderInput } = useDropzone({ onDrop: (files) => onDrop(files, 'ORDER') });

  return (
    <div className="grid grid-cols-2 gap-4 text-xs font-bold">
      <div {...getOdpProps()} className="border-2 border-dashed border-blue-400 p-6 text-center bg-blue-50 cursor-pointer">
        <input {...getOdpInput()} />
        <p>Drop file ODP di sini</p>
      </div>
      <div {...getOrderProps()} className="border-2 border-dashed border-purple-400 p-6 text-center bg-purple-50 cursor-pointer">
        <input {...getOrderInput()} />
        <p>Drop file Order di sini</p>
      </div>
    </div>
  );
}
