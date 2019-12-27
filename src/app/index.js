import React from 'react';
import ReactDOM from 'react-dom';
import {BrowserRouter, Route} from "react-router-dom";
import Home from "./container";

ReactDOM.render(<BrowserRouter><Route component={Home}/></BrowserRouter>, document.getElementById('root'));
