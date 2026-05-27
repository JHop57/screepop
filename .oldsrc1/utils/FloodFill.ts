
/*
Telos, α☧ω
July 2025
floodfill using a variable cost CostMatrix
*/

import { noConflict } from "lodash";
import Tools from "./Tools";

type NewNode = {
  x:number
  y:number
}
type Pos = {
  x:number
  y:number
  roomName: string
}


export default class FloodFill{
  //distance transform is from target, so search is towards origin
  static search(targets:{pos:Pos,g:number}[], land:CostMatrix){
    const roomName = targets[0].pos.roomName
    let fill = new PathFinder.CostMatrix();
    let nodes:NewNode[] = []

    for(let target of targets){
      nodes.push({x:target.pos.x, y:target.pos.y})
      fill.set(target.pos.x, target.pos.y, target.g)
    }
    nodes.sort((a,b) => fill.get(a.x,a.y)-fill.get(b.x,b.y))
    //console.log(`nodes initial: ${JSON.stringify(nodes)}`)
    let node = nodes[0]




    let i = 0
    //let node = {x:target.x, y:target.y}
    fill.set(node.x,node.y, 0)

    while(nodes.length>0 && i<3000){ //change for out of room
      i++
      node = nodes.shift() as NewNode//certain to not be empty

      //if(node.x==origin.x && node.y==origin.y) return fill

      const g = fill.get(node.x,node.y)

      for(let dir of Tools.DIRECTIONS){
        const newCoords = Tools.getOffset( {x:node.x, y:node.y, roomName:roomName} , dir);
        const cost = land.get(newCoords.x, newCoords.y)

        if(newCoords.x<0 || newCoords.x>49 || newCoords.y<0 || newCoords.y>49) continue //index out of bounds
        if(cost == 255) continue //impassible obstacle

        const newG = fill.get(newCoords.x,newCoords.y)
        if(newG>0){
          if(newG <= g + cost) continue
          else {
            if(!nodes.some(obj => obj.x == newCoords.x && obj.y == newCoords.y)) nodes.unshift({x:newCoords.x, y:newCoords.y})

            fill.set(newCoords.x,newCoords.y, g+cost)
            continue
          }
        }

        fill.set(newCoords.x,newCoords.y, g+cost)//mark tile as already in/through the heap

        nodes.push({x:newCoords.x, y:newCoords.y})
      }
    }
    return fill
  }
}
