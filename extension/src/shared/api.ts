import { ScoreRequestPayload, ScoreResponsePayload, SyllabusSummary } from './types.js';

export async function parseSyllabusFile(backendUrl: string, file: File): Promise<SyllabusSummary> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${backendUrl}/parse-syllabus`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Syllabus parse failed with status ${response.status}`);
  }

  return (await response.json()) as SyllabusSummary;
}

export async function scoreVideoWithBackend(
  backendUrl: string,
  payload: ScoreRequestPayload
): Promise<ScoreResponsePayload> {
  const response = await fetch(`${backendUrl}/score-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Backend score failed with status ${response.status}`);
  }

  return (await response.json()) as ScoreResponsePayload;
}
