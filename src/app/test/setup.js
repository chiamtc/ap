import {JSDOM} from 'jsdom';
import "web-audio-test-api";
import 'jest-canvas-mock';

const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
