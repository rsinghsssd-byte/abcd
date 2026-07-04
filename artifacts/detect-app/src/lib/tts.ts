export function speak(text: string) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch {
    // TTS unavailable
  }
}

let _interacted = false;

export function trySpeak(text: string): boolean {
  if (!text) return false;
  if (_interacted) {
    speak(text);
    return true;
  }
  return false;
}

export function setInteractionFlag() {
  _interacted = true;
}
