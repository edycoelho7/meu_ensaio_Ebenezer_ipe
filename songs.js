// songs.js — catálogo simples (somente leitura no app)
export const SONGS = [
  {
    id: "0000001",
    title: "Meu Maior Amor",
    artist: "Nivea Soares",
    bpm: 148,
    timeSignature: "4/4",
    offset: -0.15,
    files: {
      voz: "./audio/voz.mp3",
      // CORREÇÃO: Fechei as aspas e coloquei o nome 'instrumental.mp3'
      playback: "./audio/playback.mp3" 
    }
  },
  {
    id: "2026-03_valsa-do-depois",
    title: "Valsa do Ontem",
    artist: "Trio ",
    bpm: 90,
    timeSignature: "3/4",
    offset: 0.00,
    files: {
      voz: "https://SEU-LINK-DIRETO/valsa_voz.mp3",
      playback: "https://SEU-LINK-DIRETO/valsa_playback.mp3"
    }
  },
  {
    id: "2026-03_valsa-do-amanha",
    title: "Valsa do Amanhã",
    artist: "Trio Y",
    bpm: 90,
    timeSignature: "3/4",
    offset: 0.00,
    files: {
      voz: "https://SEU-LINK-DIRETO/valsa_voz.mp3",
      playback: "https://SEU-LINK-DIRETO/valsa_playback.mp3"
    }
  }
];