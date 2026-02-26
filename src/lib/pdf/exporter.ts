import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { getStore } from '@netlify/blobs';
import { ClientProposalPdf, InternalEstimatePdf, MaterialsPdf } from './docs';

export async function buildPdf(kind: 'materials' | 'internal' | 'proposal', payload: any) {
  const doc = kind === 'materials'
    ? React.createElement(MaterialsPdf, payload)
    : kind === 'internal'
      ? React.createElement(InternalEstimatePdf, payload)
      : React.createElement(ClientProposalPdf, payload);
  return renderToBuffer(doc);
}

export async function storePdf(path: string, buffer: Buffer) {
  const store = getStore('decktakeoff-docs');
  await store.set(path, buffer, { contentType: 'application/pdf' });
  return path;
}

export async function readPdf(path: string) {
  const store = getStore('decktakeoff-docs');
  const data = await store.get(path, { type: 'arrayBuffer' });
  return data ? Buffer.from(data) : null;
}
