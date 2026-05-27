/*
Telos, α☧ω
July 2025
A* based algorithm that returns a distance transform from the first pos that covers the area between the two positions
*/

import NodeBinaryHeap from "./NodeBinaryHeap"

type NewNode = {
  x:number
  y:number
  f:number
  g:number
}
type PartialDistanceTransform = { [key: number]: { [key: number]: number } } //2d associative array
type Pos = {
  x:number
  y:number
  roomName: string
}

const H_BIAS = 1.2
const DIRECTIONS = [1,2,3,4,5,6,7,8]
const DIRECTION_OFFSETS: { [key: number]: number[] } = {
  1: [0, -1],  // TOP
  2: [1, -1],  // TOP_RIGHT
  3: [1, 0],   // RIGHT
  4: [1, 1],   // BOTTOM_RIGHT
  5: [0, 1],   // BOTTOM
  6: [-1, 1],  // BOTTOM_LEFT
  7: [-1, 0],  // LEFT
  8: [-1, -1]  // TOP_LEFT
};

function maxDistance(pos1: Pos, pos2: Pos) {
  const gpos1 = getWorldCoord(pos1);
  const gpos2 = getWorldCoord(pos2);
  const xDiff = Math.abs(gpos1.x - gpos2.x);
  const yDiff = Math.abs(gpos1.y - gpos2.y);
  const maxDistance = Math.max(xDiff, yDiff);
  return maxDistance;
}

function getWorldCoord(pos: Pos) {
  let { x, y, roomName } = pos;
  if (x < 0 || x > 49) throw new RangeError("x value " + x + " not in range");
  if (y < 0 || y > 49) throw new RangeError("y value " + y + " not in range");
  if (roomName == "sim") throw new RangeError("Sim room does not have world position");
  let [name, h, wxs, v, wys] = roomName.match(/^([WE])([0-9]+)([NS])([0-9]+)$/) as RegExpMatchArray;
  let [wx, wy] = [parseInt(wxs), parseInt(wys)];

  if (h == "W") wx = ~wx;
  if (v == "N") wy = ~wy;
  return { x: 50 * wx + x, y: 50 * wy + y };
}

function getOffset(coords:Pos, dir:number) {
  const offset = DIRECTION_OFFSETS[dir];
  return {x:coords.x + offset[0], y:coords.y + offset[1], roomName:coords.roomName};
}

export default class astarflood{
  //distance transform is from target, so search is towards origin
  static search(target:Pos, origin:Pos, land:CostMatrix, priorFill?:PartialDistanceTransform){
    if(target.roomName != origin.roomName){
      console.log("can't handle multirooms yet!")
      return
    }

    let vis = new RoomVisual(target.roomName)


    let nodes = new NodeBinaryHeap()
    let fill = new Map();
    fill.set(`${target.x},${target.y}`, 0.1)
    let secondaryFill = new Map()
    let i = 0
    let earlyExplore = true
    let node = {x:target.x, y:target.y, f:0+maxDistance(origin, target)*H_BIAS, g:0}
    let nextNode
    while(!nodes.isEmpty() && i<3000 || i<1){ //change for out of room
      i++
      if (!earlyExplore) node = nodes.pop() as NewNode//certain to not be empty
      earlyExplore = false

      //if(node.x==origin.x && node.y==origin.y) return fill

      const g = node.g
      fill.set(`${node.x},${node.y}`, g)
      secondaryFill.set(`${node.x},${node.y}`, node.f+0.001*i)

      for(let dir of DIRECTIONS){
        const newCoords = getOffset( {x:node.x, y:node.y, roomName:target.roomName} , dir);
        const cost = land.get(newCoords.x, newCoords.y)

        if(newCoords.x<0 || newCoords.x>49 || newCoords.y<0 || newCoords.y>49) continue //index out of bounds
        if(cost == 255) continue //impassible obstacle

        if(fill.has(`${newCoords.x},${newCoords.y}`)){
          if(fill.get(`${newCoords.x},${newCoords.y}`) <= g + cost) continue //old node that doesn't need updating
          else {
            if(!nodes.updateNode(newCoords.x, newCoords.y, g+cost+(maxDistance(origin, newCoords)*H_BIAS), g+cost)){
              vis.circle(newCoords.x, newCoords.y)
            }
            continue
          }
        }

        fill.set(`${newCoords.x},${newCoords.y}`, g+cost)//mark tile as already in/through the heap

        const newF = g+cost+(maxDistance(origin, newCoords)*H_BIAS)
        if(node.f >= newF && !earlyExplore){
          earlyExplore = true
          nextNode = {x:newCoords.x, y:newCoords.y, f:newF, g:g+cost}
          continue
        }
        nodes.push({x:newCoords.x, y:newCoords.y, f:newF, g:g+cost})
      }
      if(earlyExplore){
        node = nextNode as NewNode
      }
    }
    console.log("hit max search opts")
    return secondaryFill
  }
}
