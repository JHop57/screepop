/* Telos α☧ω
July 2025
credit to:
tedivm
Marijn Haverbeke binary heap
Robert Hafner's screeps astar
Claude AI for helping me untangle binary heaps
*/

type NewNode = {
  x:number
  y:number
  f:number
  g:number
}

export default class NodeBinaryHeap{
  content: NewNode[] = []

  push(element: NewNode) {
    const content = this.content as NewNode[];

    // Add to end and cache its f value
    content.push(element);
    const elemF = element.f;
    const elemG = element.g

    // Bubble up with direct property access
    let n = content.length - 1;
    while (n > 0) {
      const parentN = ((n + 1) >> 1) - 1;
      const parent = content[parentN];

      if (elemF < parent.f || (elemF == parent.f && elemG<parent.g)) {
        content[parentN] = element;
        content[n] = parent;
        n = parentN;
      } else {
        break;
      }
    }
  }

  updateNode(x:number,y:number,newF:number, newG: number){
    const content = this.content;
    let n = content.findIndex(node => node.x === x && node.y === y);
    if (n === -1) return false;

    content[n].f = newF
    content[n].g = newG
    const elemF = newF
    const elemG = newG
    const element = content[n]

    while (n > 0) {
      const parentN = ((n + 1) >> 1) - 1;
      const parent = content[parentN];

      // Direct .f comparison - much faster
      if (elemF < parent.f || (elemF == parent.f && elemG>parent.g)) {
        content[parentN] = element;
        content[n] = parent;
        n = parentN;
      } else {
        break;
      }
    }

    return true
  }

  pop() {
    const content = this.content as NewNode[];


    if (content.length <= 1) return content.pop();

    const result = content[0];
    const end = content.pop() as NewNode; //already tested if empty

    // Bubble down with cached f value
    content[0] = end;
    const endF = end.f;
    const endG = end.g
    let n = 0;

    const len = content.length;
    while (true) {
      const child1N = (n << 1) + 1;
      const child2N = child1N + 1;
      let swap = -1;
      let swapF = endF;
      let swapG = endG

      if (child1N < len) {
        const child1F = content[child1N].f;
        const child1G = content[child1N].g;
        if (child1F < swapF || (child1F == swapF && child1G > swapG)) {
          swap = child1N;
          swapF = child1F;
          swapG = child1G
        }
      }

      if (child2N < len) {
        const child2F = content[child2N].f;
        const child2G = content[child2N].g;
        if (child2F < swapF || (child2F == swapF && child2G > swapG)) {
          swap = child2N;
          swapF = child2F
          swapG = child2G
        }
      }

      if (swap === -1) break;

      content[n] = content[swap];
      content[swap] = end;
      n = swap;
    }

    return result;
  }

  size() {
    return this.content.length;
  }

  peek() {
    return this.content[0];
  }

  isEmpty() {
    return this.content.length === 0;
  }
}
