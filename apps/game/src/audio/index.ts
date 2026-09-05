/**
 * Áudio (MI-12) — barramento WebAudio do jogo.
 *
 * A interface consumida pelo resto do app é `AudioBus` (definida em
 * `app/contracts.ts`); este barrel expõe a implementação concreta e suas
 * opções de construção.
 */
export { WebAudioBus, type AudioBusOptions } from './audio-bus'
export type { AudioBus, SoundEffect } from '../app/contracts'
