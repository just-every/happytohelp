/*
 * favcount.js v1.5.0
 * http://chrishunt.co/favcount
 * Dynamically updates the favicon with a number.
 *
 * Copyright 2013, Chris Hunt
 * Released under the MIT license
 */

function Favcount(icon_count, icon_clear) {
    this.icon_count = icon_count;
    this.icon_clear = icon_clear;
    this.canvas = document.createElement('canvas');
    this.font = "Helvetica, Arial, sans-serif";
}

Favcount.prototype.set = function (count) {
    var self = this,
        img = document.createElement('img');

    const normalize = (count) => {
        count = Math.round(count);

        if (isNaN(count) || count < 1) {
            return '';
        } else if (count < 10) {
            return ' ' + count;
        } else if (count > 99) {
            return '99';
        } else {
            return count;
        }
    }

    const drawCanvas = (canvas, font, img, count) => {
        var head = document.getElementsByTagName('head')[0],
            favicons = document.querySelectorAll('link[rel=icon]'),
            newFavicon = document.createElement('link'),
            multiplier, fontSize, context, xOffset, yOffset, border, shadow, opacity, color;

        // Scale canvas elements based on favicon size
        multiplier = img.width / 16;
        fontSize = multiplier * 10.3;
        xOffset = multiplier * 1.78;
        yOffset = multiplier * 11.3;
        color = '#141414';
        if(count < 10) {
            opacity = 1;
        }
        else {
            opacity = 0.1;
        }
        border = multiplier;
        shadow = multiplier;

        canvas.height = canvas.width = img.width;
        context = canvas.getContext('2d');
        context.font = fontSize + 'px ' + font;

        // Draw faded favicon background
        if (count) {
            context.globalAlpha = opacity;
        }
        context.drawImage(img, 0, 0);
        context.globalAlpha = 1.0;

        // Draw white drop shadow
        context.shadowColor = '#FFF';
        context.shadowBlur = shadow;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;

        // Draw white border
        context.fillStyle = '#FFF';
        context.fillText(count, xOffset, yOffset);
        context.fillText(count, xOffset + border, yOffset);
        context.fillText(count, xOffset, yOffset + border);
        context.fillText(count, xOffset + border, yOffset + border);

        // Draw count
        context.fillStyle = color;
        context.fillText(count,
            xOffset + (border / 2.0),
            yOffset + (border / 2.0)
        );

        // Replace favicon with new favicon
        newFavicon.rel = 'icon';
        newFavicon.href = canvas.toDataURL('image/png');
        if (favicons) {
            favicons.forEach(function(favicon) {
                head.removeChild(favicon);
            });
        }
        head.appendChild(newFavicon);
    }

    if (self.canvas.getContext) {
        img.crossOrigin = "anonymous";

        img.onload = function () {
            drawCanvas(self.canvas, self.font, img, normalize(count));
        };

        img.src = count ? this.icon_count : this.icon_clear;
    }
};

export default Favcount;
