import { WavyJones } from "./wavy-jones.js";

var context = null;   // the Web Audio "context" object
var midiAccess = null;  // the MIDIAccess object.
var oscillator = null;  // the single oscillator
var envelope = null;    // the envelope for the single oscillator
var attack = 0.05;      // attack speed
var release = 0.05;   // release speed
var portamento = 0;  // portamento/glide speed
var activeNotes = []; // the stack of actively-pressed keys
let activeMusic = false;
let midiObject = {}; //musical event to store
let musicalLayer = []; //collection of musical events to store
let contextPlayback = null;
let oscillatorPlayback = null;
let envelopePlayback = null;
let attackPlayback = 0.05;      // attack speed
let releasePlayback = 0.05;   // release speed
let portamentoPlayback = 0;  // portamento/glide speed
let recordStartTime = null;

window.addEventListener('click', function() {
  // patch up prefixes
    if (!activeMusic) {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
        const myOscilloscope = new WavyJones(context, 'oscilloscope');
        if (navigator.requestMIDIAccess)
            navigator.requestMIDIAccess().then(onMIDIInit, onMIDIReject);
        else
            alert("No MIDI support present in your browser.  You're gonna have a bad time.");
        // set up the basic oscillator chain, muted to begin with.
        oscillator = context.createOscillator();
        oscillator.frequency.setValueAtTime(110, 0);
        envelope = context.createGain();
        oscillator.connect(envelope);
        oscillator.type = 'sawtooth';
        // envelope.connect(context.destination);
        envelope.connect(myOscilloscope);
        myOscilloscope.connect(context.destination);
        envelope.gain.value = 0.0;  // Mute the sound
        oscillator.start();  // Go ahead and start up the oscillator
        context.resume();
        activeMusic = true;
    };
});


// var context = new AudioContext(),
//     sineWave = context.createOscillator(),
//     myOscilloscope = new WavyJones(context, 'oscilloscope');

// sineWave.connect(myOscilloscope);
// myOscilloscope.connect(context.destination);

// sineWave.start(0);


function onMIDIInit(midi) {
    midiAccess = midi;
    var haveAtLeastOneDevice=false;
    var inputs = midiAccess.inputs.values();
    for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
        input.value.onmidimessage = MIDIMessageEventHandler;
        haveAtLeastOneDevice = true;
    }
    if (!haveAtLeastOneDevice)
        alert("No MIDI input devices present.  You're gonna have a bad time.");
}
function onMIDIReject(err) {
    alert("The MIDI system failed to start.  You're gonna have a bad time.");
}
function MIDIMessageEventHandler(event) {
  // Mask off the lower nibble (MIDI channel, which we don't care about)
    midiObject = { 
        note_switch: event.data[0],
        note_name: event.data[1],
        note_velocity: event.data[2],
        note_time: context.currentTime - recordStartTime
    };
    storingMusic(midiObject);
    switch (event.data[0] & 0xf0) {
        case 0x90:
            if (event.data[2] !== 0) {  // if velocity != 0, this is a note-on message
                noteOn(event.data[1]);
                return;
            }
        // if velocity == 0, fall thru: it's a note-off.  MIDI's weird, y'all.
        case 0x80:
                noteOff(event.data[1]);
            return;
    }
}
function frequencyFromNoteNumber(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}
function noteOn(noteNumber) {
    activeNotes.push(noteNumber);
    oscillator.frequency.cancelScheduledValues(0);
    oscillator.frequency.setTargetAtTime(frequencyFromNoteNumber(noteNumber), 0, portamento);
    envelope.gain.cancelScheduledValues(0);
    envelope.gain.setTargetAtTime(1.0, 0, attack);
}
function noteOff(noteNumber) {
    var position = activeNotes.indexOf(noteNumber);
    if (position !== -1) {
        activeNotes.splice(position, 1);
    }
    if (activeNotes.length === 0) {  // shut off the envelope
        envelope.gain.cancelScheduledValues(0);
        envelope.gain.setTargetAtTime(0.0, 0, release);
    } else {
        oscillator.frequency.cancelScheduledValues(0);
        oscillator.frequency.setTargetAtTime(frequencyFromNoteNumber(activeNotes[activeNotes.length - 1]), 0, portamento);
    }
}
const testDiv = document.getElementById('test-div');
const recordStartButton = document.createElement('button');
const recordStopButton = document.createElement('button');
const recordPlayButton = document.createElement('button');
recordStartButton.textContent = 'Record Start';
recordStartButton.style.color = 'red';
testDiv.appendChild(recordStartButton);
recordStopButton.textContent = 'Record Stop';
recordStopButton.style.color = 'red';
testDiv.appendChild(recordStopButton);
recordPlayButton.textContent = 'Record PLAY';
recordPlayButton.style.color = 'red';
testDiv.appendChild(recordPlayButton);
// setTimeout(() => {playStoredMusic(musicalLayer)}, 10000);
recordStartButton.addEventListener('click', () => {
    musicalLayer = [];
    recordStartTime = context.currentTime;
});
recordPlayButton.addEventListener('click', () => {
    {playStoredMusic(musicalLayer)}
});
function storingMusic(midiObject) {
    musicalLayer.push(midiObject);
    console.log(musicalLayer);
};
function playStoredMusic(musicalLayer) {
    contextPlayback = new AudioContext();
    // set up the basic oscillator chain, muted to begin with.
    oscillatorPlayback = contextPlayback.createOscillator();
    oscillatorPlayback.frequency.setValueAtTime(440, 0);
    envelopePlayback = contextPlayback.createGain();
    oscillatorPlayback.connect(envelopePlayback);
    oscillatorPlayback.type = 'sawtooth';
    envelopePlayback.connect(contextPlayback.destination);
    envelopePlayback.gain.value = 0.0;  // Mute the sound
    oscillatorPlayback.start();  // Go ahead and start up the oscillator
    for (let i = 0; i < musicalLayer.length; i++){
        const currentNoteValue = musicalLayer[i];
        if (currentNoteValue.note_switch === 144) { //note on!
            oscillatorPlayback.frequency.setTargetAtTime(frequencyFromNoteNumber(currentNoteValue.note_name), currentNoteValue.note_time, portamento);
            envelopePlayback.gain.setTargetAtTime(1.0, currentNoteValue.note_time, attackPlayback);
        } else if (currentNoteValue.note_switch === 128) { //note off!
            envelopePlayback.gain.setTargetAtTime(0, currentNoteValue.note_time, releasePlayback);
        }
    }
}
///////
let waveform = 'sawtooth';
//KEYBOARD STUFF
document.addEventListener('DOMContentLoaded', function(event) {
    //SET UP AUDIO CONTEXT
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    //PROCESSING CHAIN
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    //OBJECT FOR STORING ACTIVE NOTES
    const activeOscillators = {};
    //KEYCODE TO MUSICAL FREQUENCY CONVERSION
    const keyboardFrequencyMap = {
        '65': 261.625565300598634,  //A - C
        '87': 277.182630976872096, //W - C#
        '83': 293.664767917407560,  //S - D
        '69': 311.126983722080910, //E - D#
        '68': 329.627556912869929,  //D - E
        '70': 349.228231433003884,  //F - F
        '84': 369.994422711634398, //T - F#
        '71': 391.995435981749294,  //G - G
        '89': 415.304697579945138, //Y - G#
        '72': 440.000000000000000,  //H - A
        '85': 466.163761518089916, //U - A#
        '74': 493.883301256124111,  //J - B
        '75': 523.251130601197269,  //K - C
        '79': 554.365261953744192, //O - C#
        '76': 587.329535834815120,  //L - D
        '80': 622.253967444161821, //P - D#
        '186': 659.255113825739859,  //; - E
        '219': 698.456462866007768,  //[ - F
        '222': 739.988845423268797, //' - F#
        // '84': 783.990871963498588,  //T - G
        // '54': 830.609395159890277, //6 - G#
        // '89': 880.000000000000000,  //Y - A
        // '55': 932.327523036179832, //7 - A#
        // '85': 987.766602512248223,  //U - B
    };
    //CONNECTIONS
    gain.connect(filter);
    filter.connect(audioCtx.destination);
    //EVENT LISTENERS FOR SYNTH PARAMETER INTERFACE
    const waveformControl = document.getElementById('waveform');
    waveformControl.addEventListener('change', function(event) {
        waveform = event.target.value;
    });
    const gainControl = document.getElementById('gain');
    gainControl.addEventListener('change', function(event) {
        gain.gain.setValueAtTime(event.target.value, audioCtx.currentTime);
    });
    const filterTypeControl = document.getElementById('filterType');
    filterTypeControl.addEventListener('change', function(event) {
        filter.type = event.target.value;
    });
    const filterFrequencyControl = document.getElementById('filterFrequency');
    filterFrequencyControl.addEventListener('change', function(event) {
        filter.frequency.setValueAtTime(event.target.value, audioCtx.currentTime);
    });
    //EVENT LISTENERS FOR MUSICAL KEYBOARD
    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);
    //CALLED ON KEYDOWN EVENT - CALLS PLAYNOTE IF KEY PRESSED IS ON MUSICAL
    //KEYBOARD && THAT KEY IS NOT CURRENTLY ACTIVE
    function keyDown(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
            playNote(key);
        }
    }
    //STOPS & DELETES OSCILLATOR ON KEY RELEASE IF KEY RELEASED IS ON MUSICAL
    //KEYBOARD && THAT KEY IS CURRENTLY ACTIVE
    function keyUp(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && activeOscillators[key]) {
            activeOscillators[key].stop();
            delete activeOscillators[key];
        }
    }
    //HANDLES CREATION & STORING OF OSCILLATORS
    function playNote(key) {
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(keyboardFrequencyMap[key], audioCtx.currentTime);
        osc.type = waveform;
        activeOscillators[key] = osc;
        activeOscillators[key].connect(gain);
        activeOscillators[key].start();
        console.log(audioCtx.currentTime);
    }
});