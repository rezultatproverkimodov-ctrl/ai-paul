const { exec } = require('child_process');

function say(text) {
    const command = `powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${text.replace(/'/g, "''")}')"`;
    exec(command, (err) => {
        if (err) console.error('[AI_Paul] TTS error:', err);
    });
}

module.exports = say;