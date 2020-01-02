//util
const style = (HTMLElement, styles) =>{
    Object.keys(styles).map((style) => HTMLElement.style[style] = styles[style]);
    return HTMLElement;
};

export default style;
