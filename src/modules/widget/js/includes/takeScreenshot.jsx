/*
 * Kinda nifty - can use getDisplayMedia to take a quick screenshot.
 * Doesn't work on mobile, but seems to have good support on desktop.
 * @todo select only part of the screenshot to upload
 * @todo allow user to capture a video (screencast)
 */
import log from "./log";

export const canTakeScreenshot = navigator.mediaDevices ? navigator.mediaDevices.getDisplayMedia : null;

const BASE64_MARKER = ';base64,';
export function dataURItoFile(prefix, dataURI) {
    // Format of a base64-encoded URL e.g. data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYAAAAEOCAIAAAAPH1dAAAAK
    let mime = dataURI.split(BASE64_MARKER)[0].split(':')[1];
    let filename = prefix+'-' + (new Date()).getTime() + '.' + mime.split('/')[1];
    let bytes = atob(dataURI.split(BASE64_MARKER)[1]);
    let writer = new Uint8Array(new ArrayBuffer(bytes.length));
    for (let i=0; i < bytes.length; i++) {
        writer[i] = bytes.charCodeAt(i);
    }

    return new File([writer.buffer], filename, { type: mime });
}

export default function takeScreenshot(files, setFiles) {
    if(!canTakeScreenshot) {
        log.warn("navigator.mediaDevices.getDisplayMedia is not supported by this device")
        return;
    }

    navigator.mediaDevices.getDisplayMedia({
        video: {
            cursor: "motion",
            displaySurface: "browser",
            logicalSurface: false,
        },
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        monitorTypeSurfaces: "exclude",
        surfaceSwitching: "exclude",
        audio: false,
    }).then(stream => {
        const root = document.getElementById("happytohelp-root");
        // Need to create a video element to send the stream to.
        const video = document.createElement('video');
        video.setAttribute('autoplay', 'true');
        video.style.opacity = '0'; // drawing with 0 opacity still allows canvas to capture image
        video.style.position = 'fixed'; // setting position further off screen causes issue with safari for some reason
        video.addEventListener('playing', function(){
            root.classList.add("happytohelp-screenshot"); // probably some better way of doing this using state

            // Timeout gives "share your screen" dialog enough time to close if visible (hopefully)
            setTimeout(async function() {
                let canvas;
                if (typeof OffscreenCanvas !== "undefined") {
                    canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
                } else {
                    canvas = document.createElement('canvas');
                }
                const ctx = canvas.getContext('2d');

                const maxSize = 2000;
                const ratio = Math.min(maxSize / video.videoWidth, maxSize / video.videoHeight);
                const newWidth = Math.round(video.videoWidth * ratio);
                const newHeight = Math.round(video.videoHeight * ratio);

                canvas.width = newWidth;
                canvas.height = newHeight;

                ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, newWidth, newHeight);

                // Convert canvas to blob and create a File object
                canvas.convertToBlob ? canvas.convertToBlob({ type: 'image/png' }).then(blob => {
                    setFiles([...files, new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' })]);
                }) : canvas.toBlob(blob => {
                    setFiles([...files, new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' })]);
                }, 'image/png');

                // Animate screen flash
                // Gives user an idea when the screenshot was actually taken
                const flash = document.createElement('div');
                flash.setAttribute('id', "happytohelp-flash");
                flash.addEventListener('animationend', () => {
                    document.body.removeChild(flash);
                });
                document.body.appendChild(flash);

                // Clean up
                root.classList.remove("happytohelp-screenshot");
                stream.getTracks().forEach(track => track.stop());
                document.body.removeChild(video);
            }, 800);

        });
        document.body.appendChild(video);

        video.srcObject = stream;
    }).catch(err => {log.error(err)})
}
