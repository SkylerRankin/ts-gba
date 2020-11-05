const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');

export const getTextWidthBasedOnElement = (text: string, element: any) : number => {
    if (context) {
        context.font = getComputedStyle(element).font;
        return context.measureText(text).width;
    } else {
        console.error("Context 2d was null, unable to calculate text width.");
        return 0;
    }
}