export const voiceclipperManifest = {
  schema_version: 2,
  manifest_version: 2,
  session_id: 'session_001',
  session: {
    session_id: 'session_001',
    recording_date: '2026-06-10',
    recording_location_type: 'home office',
    microphone: 'iPhone built-in mic',
    source_audio_filename: 'test.m4a',
  },
  speaker: {
    speaker_id: 'speaker_ariel_001',
    speaker_name: 'Ariel Goldman',
    consent_status: 'owned/self-recorded',
  },
  processing: {
    voiceclipper: {
      version: '0.5.0',
      completed_at: '2026-06-10T12:00:00.000Z',
    },
  },
  clips: [
    {
      clip_id: 'session_001_000001',
      phrase_id: 'close_the_door',
      filename: 'close_the_door.wav',
      phrase_text: 'Close the door.',
      content_metadata: {
        species: 'human',
        emotion: 'tense',
        intensity: 3,
      },
    },
    {
      clip_id: 'session_001_000002',
      phrase_id: 'who_sent_you',
      filename: 'who_sent_you.wav',
      phrase_text: 'Who sent you?',
      content_metadata: {
        species: 'human',
        emotion: 'guarded',
      },
    },
  ],
};
