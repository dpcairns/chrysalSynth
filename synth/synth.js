//IMPORT OSCILLOSCOPE JS
import { OScope } from './oscope.js';

var midiAccess = null;  // the MIDIAccess object.
var portamento = 0;  // portamento/glide speed
var activeNotes = []; // the stack of actively-pressed keys

let midiObject = {}; //midi event to store
let keyObject = {}; //keyboard event to store
let musicalLayer = []; //collection of musical events to store
let contextPlayback = null;
let oscillatorPlayback = null;
let envelopePlayback = null;
let attackPlayback = 0.05;      // attack speed
let releasePlayback = 0.05;   // release speed
let portamentoPlayback = 0;  // portamento/glide speed
let recordStartTime = null;

/////

var mouseX = 0,
	mouseY = 0,
	windowHalfX = window.innerWidth / 2,
	windowHalfY = window.innerHeight / 2,
	camera,
	scene,
	renderer,
	material,
	container;
var source;

var buffer;
var audioBuffer;
var dropArea;
var audioContext;
var source;
//var processor;
// var analyser;
var xhr;
var started = true;




// DOM RECORD BUTTONS
const recordStartButton = document.getElementById('recordButton');
// const recordStopButton = document.getElementById('record-stop');
const recordPlayButton = document.getElementById('record-play');

// DOM SYNTH CONTROLS
const waveformControl = document.getElementById('waveform');
let waveform = waveformControl.value;
const gainControl = document.getElementById('gain');
const frequencyControlLP = document.getElementById('filterFrequencyLP');
const frequencyControlHP = document.getElementById('filterFrequencyHP');
const frequencyControlBP = document.getElementById('filterFrequencyBP');
const lfoControl = document.getElementById('lfoValue');



//KEYBOARD STUFF
document.addEventListener('DOMContentLoaded', function(event) {
    //SET UP AUDIO CONTEXT
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    //SETUP OSCILLOSCOPE
    const myOscilloscope = new OScope(audioCtx, 'oscilloscope');

    let analyser = audioCtx.createAnalyser();
	analyser.fftSize = 1024;
	analyser.smoothingTimeConstant = 0.1;
  
    //PROCESSING CHAIN
    const gain = audioCtx.createGain();
    const filterLP = audioCtx.createBiquadFilter();
    const filterHP = audioCtx.createBiquadFilter();
    const filterBP = audioCtx.createBiquadFilter();
  
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
        '222': 698.456462866007768,  //' - F
        '221': 739.988845423268797, //] - F#
        // '84': 783.990871963498588,  //T - G
        // '54': 830.609395159890277, //6 - G#
        // '89': 880.000000000000000,  //Y - A
        // '55': 932.327523036179832, //7 - A#
        // '85': 987.766602512248223,  //U - B
    };


  
    //CONNECTIONS
    gain.connect(analyser);
    // gain.connect(filterLP);
    // filterLP.connect(filterHP);
    // filterHP.connect(filterBP);
    // filterBP.connect(myOscilloscope);

    // source.connect(analyser);
    // analyser.connect(myOscilloscope);
    analyser.connect(audioCtx.destination);
    
    myOscilloscope.connect(audioCtx.destination);
  
    //EVENT LISTENERS FOR SYNTH PARAMETER INTERFACE
    waveformControl.addEventListener('change', function(event) {
        waveform = event.target.value;
    });
  
    gainControl.addEventListener('mousemove', function(event) {
        gain.gain.setValueAtTime(event.target.value, audioCtx.currentTime);
    });

    frequencyControlLP.addEventListener('mousemove', function(event) {
        filterLP.type = 'lowpass';
        filterLP.frequency.setValueAtTime(event.target.value, audioCtx.currentTime);
    });

    frequencyControlHP.addEventListener('mousemove', function(event) {
        filterHP.type = 'highpass';
        filterHP.frequency.setValueAtTime(event.target.value, audioCtx.currentTime);
    });

    frequencyControlBP.addEventListener('mousemove', function(event) {
        filterBP.type = 'bandpass';
        filterBP.frequency.setValueAtTime(event.target.value, audioCtx.currentTime);
    });

    // lfoControl.addEventListener('mousemove', function(event) {
    //     lfo.frequency.setValueAtTime(event.target.value, audioCtx.currentTime);
    // });
  
    //EVENT LISTENERS FOR MUSICAL KEYBOARD
    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);
  
    //CALLED ON KEYDOWN EVENT - CALLS PLAYNOTE IF KEY PRESSED IS ON MUSICAL
    //KEYBOARD && THAT KEY IS NOT CURRENTLY ACTIVE
    function keyDown(event, e) {
        const key = (event.detail || event.which).toString();
        const keyImage = document.querySelector(`.key[data-key="${e.keyCode}"]`);
        keyImage.classList.add('active');

        keyObject = {
            note_switch: 144,
            note_name: keyboardFrequencyMap[key],
            note_velocity: 127,
            note_time: audioCtx.currentTime - recordStartTime
        };
        storingMusic(keyObject);

        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
            playNote(key);
        }
    }
  
    //STOPS & DELETES OSCILLATOR ON KEY RELEASE IF KEY RELEASED IS ON MUSICAL
    //KEYBOARD && THAT KEY IS CURRENTLY ACTIVE
    function keyUp(event, e) {
        const key = (event.detail || event.which).toString();
        const keyImage = document.querySelector(`.key[data-key="${e.keyCode}"]`);
        keyImage.classList.remove('active');

        keyObject = {
            note_switch: 128,
            note_name: keyboardFrequencyMap[key],
            note_velocity: 0,
            note_time: audioCtx.currentTime - recordStartTime
        };
        storingMusic(keyObject);

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
    }


    //MIDI
    function noteOn(noteNumber) {
        const osc = audioCtx.createOscillator();
        osc.frequency.setTargetAtTime(frequencyFromNoteNumber(noteNumber), 0, portamento);
        osc.type = waveform;
        activeOscillators[noteNumber] = osc;
        activeOscillators[noteNumber].connect(gain);
        activeOscillators[noteNumber].start();
    }

    function noteOff(noteNumber) {
        var position = activeNotes.indexOf(noteNumber);
        if (position !== -1) {
            activeNotes.splice(position, 1);
        }
        if (activeNotes.length === 0) {  // shut off the envelope
            activeOscillators[noteNumber].stop();
            delete activeOscillators[noteNumber];
        } else {
            activeOscillators[noteNumber].stop();
            delete activeOscillators[noteNumber];
        }

    }

    function frequencyFromNoteNumber(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    if (navigator.requestMIDIAccess)
        navigator.requestMIDIAccess().then(onMIDIInit, onMIDIReject);
    else
        alert("No MIDI support present in your browser.  You're gonna have a bad time.");


    function onMIDIInit(midi) {
        midiAccess = midi;

        var haveAtLeastOneDevice = false;
        var inputs = midiAccess.inputs.values();
        for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
            input.value.onmidimessage = MIDIMessageEventHandler;
            haveAtLeastOneDevice = true;
        }
        if (!haveAtLeastOneDevice)
            // alert("No MIDI input devices present.  You're gonna have a bad time.");
            return;
    }

    function onMIDIReject(err) {
        alert("The MIDI system failed to start.  You're gonna have a bad time.");
    }

    function MIDIMessageEventHandler(event) {
        // Making Midi Object to store
        const midiFreq = frequencyFromNoteNumber(event.data[1]);
        midiObject = {
            note_switch: event.data[0],
            note_name: midiFreq,
            note_velocity: event.data[2],
            note_time: audioCtx.currentTime - recordStartTime
        };
        storingMusic(midiObject);

        switch (event.data[0] & 0xf0) {
            case 0x90:
                if (event.data[2] !== 0) {  // if velocity != 0, this is a note-on message
                    noteOn(event.data[1]);
                    return;
                }
                break;
            // if velocity == 0, fall thru: it's a note-off.  MIDI's weird, y'all.
            case 0x80:
                noteOff(event.data[1]);
                return;
        }
    }





    //RECORDING

    // recordStartButton.addEventListener('click', () => {
    //     musicalLayer = [];
    //     recordStartTime = audioCtx.currentTime;
    // });
    
    function storingMusic(musicObject) {
        musicalLayer.push(musicObject);
        console.log(musicalLayer);
    }




    //PLAYBACK

    //

    function playStoredMusic(musicalLayer) {

        contextPlayback = new AudioContext();
        const activeOscillatorsPlayback = {};
    
        // set up the basic oscillator chain, muted to begin with.
        // oscillatorPlayback = contextPlayback.createOscillator();
        // oscillatorPlayback.frequency.setValueAtTime(440, 0);
        // envelopePlayback = contextPlayback.createGain();
        // oscillatorPlayback.connect(envelopePlayback);
        // oscillatorPlayback.type = 'sawtooth';
        // envelopePlayback.connect(contextPlayback.destination);
        // envelopePlayback.gain.value = 0.0;  // Mute the sound
        // oscillatorPlayback.start();  // Go ahead and start up the oscillator
    
        for (let i = 0; i < musicalLayer.length; i++){
            const currentNoteValue = musicalLayer[i];
            const oscillatorPlayback = contextPlayback.createOscillator();

            activeOscillatorsPlayback[currentNoteValue.note_name] = oscillatorPlayback;

            
    
            if (currentNoteValue.note_switch === 144) { //note on!
                // oscillatorPlayback.frequency.setValueAtTime(440, 0);
                envelopePlayback = contextPlayback.createGain();
               
                oscillatorPlayback.connect(envelopePlayback);
                oscillatorPlayback.type = 'sawtooth';
                envelopePlayback.connect(contextPlayback.destination);
                envelopePlayback.gain.value = 0.0;  // Mute the sound
                oscillatorPlayback.start();  // Go ahead and start up the oscillator
                oscillatorPlayback.frequency.setTargetAtTime(currentNoteValue.note_name, currentNoteValue.note_time, portamento);
                envelopePlayback.gain.setTargetAtTime(1.0, currentNoteValue.note_time, attackPlayback);
            } else if (currentNoteValue.note_switch === 128) { //note off!               
                console.log('off');
                console.log(currentNoteValue.note_name);
                // activeOscillatorsPlayback[currentNoteValue.note_name].stop();

                envelopePlayback.gain.setTargetAtTime(0, currentNoteValue.note_time, releasePlayback);
                // oscillatorPlayback.stop();
                console.log(oscillatorPlayback);
                delete activeOscillatorsPlayback[currentNoteValue.note_name];
                console.log(activeOscillatorsPlayback);
                
                // activeOscillatorsPlayback[currentNoteValue.note_name].stop();
                
            }
        }
    }
});

///////////////////
/**
 *
 * Loop Waveform Visualizer by Felix Turner
 * www.airtight.cc
 *
 * Audio Reactive Waveform via Web Audio API.
 *
 */



$(document).ready(function() {
	//Chrome is only browser to currently support Web Audio API
	var is_webgl = (function() {
		try {
			return !!window.WebGLRenderingContext && !!document.createElement('canvas').getContext('experimental-webgl');
		} catch (e) {
			return false;
		}
	})();

	if (!is_webgl) {
		$('#loading').html(
			'Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">WebGL</a>.<br />' +
				'Find out how to get it <a href="http://get.webgl.org/">here</a>, or try restarting your browser.'
		);
	} else {
		$('#loading').html('drop mp3 here or <a id="loadSample">load sample mp3</a>');
		init();
	}
});

function init() {
	//init 3D scene
	container = document.createElement('div');
	document.body.appendChild(container);
	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000000);
	camera.position.z = 350;
	scene = new THREE.Scene();
	scene.add(camera);
	renderer = new THREE.WebGLRenderer({
		antialias: false,
		sortObjects: false,
	});
	renderer.setSize(window.innerWidth, window.innerHeight);

	container.appendChild(renderer.domElement);

	// stop the user getting a text cursor
	document.onselectStart = function() {
		return false;
	};

	//add stats
	// stats = new Stats();
	// stats.domElement.style.position = 'absolute';
	// stats.domElement.style.top = '0px';
	// container.appendChild(stats.domElement);

	//init listeners
	$('#loadSample').click(loadSampleAudio);
	$(document).mousemove(onDocumentMouseMove);
	$(window).resize(onWindowResize);
	document.addEventListener('drop', onDocumentDrop, false);
	document.addEventListener('dragover', onDocumentDragOver, false);

	onWindowResize(null);
}

function loadSampleAudio() {
	$('#loading').text('loading...');

	audioContext = new window.AudioContext();

	source = audioContext.createBufferSource();
	analyser = audioContext.createAnalyser();
	analyser.fftSize = 1024;
	analyser.smoothingTimeConstant = 0.1;

	// Connect audio processing graph
	// source.connect(analyser);
	// analyser.connect(audioContext.destination);

	loadAudioBuffer('audio/EMDCR.mp3');
}

function loadAudioBuffer(url) {
	// Load asynchronously
	var request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.responseType = 'arraybuffer';

	request.onload = function() {
		audioContext.decodeAudioData(
			request.response,
			function(buffer) {
				audioBuffer = buffer;
				finishLoad();
			},
			function(e) {
				console.log(e);
			}
		);
	};
	request.send();
}

function finishLoad() {
	source.buffer = audioBuffer;
	source.loop = true;
	source.start(0.0);
	startViz();
}

function onDocumentMouseMove(event) {
	mouseX = (event.clientX - windowHalfX) * 2;
	mouseY = (event.clientY - windowHalfY) * 2;
}

function onWindowResize(event) {
	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
	requestAnimationFrame(animate);
	render();
	//stats.update();
}

function render() {
	LoopVisualizer.update();

	//mouse tilt
	var xrot = mouseX / window.innerWidth * Math.PI + Math.PI;
	var yrot = mouseY / window.innerHeight * Math.PI + Math.PI;
	LoopVisualizer.loopHolder.rotation.x += (-yrot - LoopVisualizer.loopHolder.rotation.x) * 0.3;
	LoopVisualizer.loopHolder.rotation.y += (xrot - LoopVisualizer.loopHolder.rotation.y) * 0.3;

	renderer.render(scene, camera);
}

$(window).mousewheel(function(event, delta) {
	//set camera Z
	camera.position.z -= delta * 50;
});

function onDocumentDragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	return false;
}

function onDocumentDrop(evt) {
	evt.stopPropagation();
	evt.preventDefault();

	//clean up previous mp3
	if (source) source.disconnect();
	LoopVisualizer.remove();

	$('#loading').show();
	$('#loading').text('loading...');

	var droppedFiles = evt.dataTransfer.files;

	var reader = new FileReader();

	reader.onload = function(fileEvent) {
		var data = fileEvent.target.result;
		initAudio(data);
	};

	reader.readAsArrayBuffer(droppedFiles[0]);
}

function initAudio(data) {
	audioContext = new window.AudioContext();
	source = audioContext.createBufferSource();

	if (audioContext.decodeAudioData) {
		audioContext.decodeAudioData(
			data,
			function(buffer) {
				source.buffer = buffer;
				createAudio();
			},
			function(e) {
				console.log(e);
				$('#loading').text('cannot decode mp3');
			}
		);
	} else {
		source.buffer = audioContext.createBuffer(data, false);
		createAudio();
	}
}

function createAudio() {
	let analyser = audioContext.createAnalyser();
	analyser.fftSize = 1024;
	analyser.smoothingTimeConstant = 0.1;
	source.connect(audioContext.destination);
	source.connect(analyser);
	source.start(0);
	source.loop = true;

	startViz();
}

function startViz() {
	$('#loading').hide();

	LoopVisualizer.init();

	if (!started) {
		started = true;
		animate();
	}
}
startViz();
/////////////
