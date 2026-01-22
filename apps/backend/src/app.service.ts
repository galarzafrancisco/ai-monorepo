import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  private colorFacts: Record<string, string> = {
    red: 'Red is the first color a baby sees, typically around 2 weeks after birth!',
    blue: 'Blue is the most popular favorite color worldwide, with about 40% of people choosing it!',
    green: 'Green is the easiest color for the eye to process and is known to reduce stress and improve focus!',
    yellow: 'Yellow is the most visible color in daylight and is often used for warning signs because it catches our attention!',
    purple: 'Purple was historically the most expensive color to produce, making it a symbol of royalty and wealth!',
    orange: 'Orange is named after the fruit, not the other way around! The color was called "geoluhread" (yellow-red) before oranges arrived in Europe.',
    pink: 'Pink is the only color named after a flower (the pink flower). It was considered a masculine color until the 1940s!',
    black: 'Black isn\'t technically a color - it\'s the absence of light! It absorbs all wavelengths of visible light.',
    white: 'White light actually contains all the colors of the rainbow! This can be seen when light passes through a prism.',
    brown: 'Brown is the rarest favorite color, with less than 1% of people choosing it as their top pick!',
  };

  getHello(): string {
    return 'Hello World!';
  }

  getColorFact(color: string): string {
    const normalizedColor = color.toLowerCase().trim();
    const fact = this.colorFacts[normalizedColor];

    if (fact) {
      return `Fun fact about ${color}: ${fact}`;
    }

    return `I don't have a fun fact about "${color}" yet, but that's an interesting choice! I have facts about: ${Object.keys(this.colorFacts).join(', ')}.`;
  }
}
