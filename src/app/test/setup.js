import {JSDOM} from 'jsdom';
import AudioContext from './webaudio_mock';
import 'jest-canvas-mock';

const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.AudioContext = AudioContext;
