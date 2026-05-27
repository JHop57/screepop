import FloodFill from "./FloodFill";
import Tools from "./Tools";

//massive credit to bonzaiferroni https://github.com/screepers/Traveler

type Pos = {
  x: number;
  y: number;
  roomName: string;
};

type RequestMove = {
  creep: Creep;
  roomName: string;
  x: number;
  y: number;
};
type PlanMove = {
  creep: Creep;
  dir: DirectionConstant;
};

class Quest {
  private static CONSTS = {
    ROAD: 1,
    PLAIN: 2,
    SWAMP: 10,
    CONTAINER: 200,
    STRUCTURE: 255,
    WALL: 255
  };

  private moveAsks: { [key: string]: RequestMove[] } = {};
  private visited = new Set()
  private plan = new Map()

  public prep(){
    this.moveAsks = {}
    this.plan = new Map()
  }

  //Quest.to()
  public to(creep: Creep, destination: Pos) {
    if (!this.moveAsks[creep.pos.roomName]) this.moveAsks[creep.pos.roomName] = [];
    this.moveAsks[creep.pos.roomName].push({
      creep: creep,
      roomName: destination.roomName,
      x: destination.x,
      y: destination.y
    });
    return true;
  }

  public act() {
    for (let roomId in this.moveAsks) {
      let obstacles = [];

      let room = Game.rooms[roomId];
      let roomMem = global.map.rooms[roomId];
      let enemyCreeps = room.find(FIND_HOSTILE_CREEPS);
      for (let enemy of enemyCreeps) {
        obstacles.push({ x: enemy.pos.x, y: enemy.pos.y }); //consider expanding wider for combat encounters
      }

      let requests = this.moveAsks[roomId];
      //requests to remain stationary take priority (or fatigued creeps)
      for (let i = 0; i < requests.length; i++) {
        let reqst = requests[i];
        if ((reqst.creep.pos.x == reqst.x && reqst.creep.pos.y == reqst.y) || reqst.creep.fatigue > 0) {
          obstacles.push({ x: reqst.x, y: reqst.y });
          requests.splice(i, 1);
          i--;
        }
      }

      this.plan = new Map()
      let creeps = room.find(FIND_MY_CREEPS)
      for(let creep of creeps){
        this.plan.set(creep.pos.x*100+creep.pos.y, creep.id)
      }


      for (let i = 0; i < requests.length; i++) {
        const reqst = requests[i];
        let intendedPos = Quest.getNextStep(reqst, reqst.creep.pos)
        if(this.plan.get(intendedPos.x*100 + intendedPos.y) == reqst.creep.id) continue

        this.visited = new Set()
        const creepPos = reqst.creep.pos
        if(this.plan.get(creepPos.x*100+creepPos.y) == reqst.creep.id){
          this.plan.delete(creepPos.x*100+creepPos.y)
        } else{
          for(let dir of Tools.DIRECTIONS){
            let searchPos = Tools.getOffset(creepPos, dir)
            if(this.plan.get(searchPos.x*100+searchPos.y) == reqst.creep.name){
              this.plan.delete(searchPos.x*100+searchPos.y)
              break
            }
          }
        }

        if(this.dfs(reqst)>0) continue

        this.plan.set(creepPos.x*100+creepPos.y, reqst.creep.id)
      }
        /*let reqst = requests[i];
        let key = `${reqst.x * 100 + reqst.y}${reqst.roomName}`;

        let pos: PathStep | RoomPosition | Pos = reqst.creep.pos;
        let surface;
        if (roomMem && roomMem.nav[key] && roomMem.nav[key].get()) {
          surface = roomMem.nav[key];
        } else if (roomMem) {
          let terrain;
          if (roomMem.terrainDate + 50 < Game.time) {
            terrain = Quest.getRoomMatrix(room);
            roomMem.terrainDate = Game.time;
          } else terrain = roomMem.terrain;

          /*surface = FloodFill.search([{ pos: { x: reqst.x, y: reqst.y, roomName: reqst.roomName }, g: 1 }], terrain);
          roomMem.nav[key] = surface;

          let path = room.findPath(reqst.creep.pos, new RoomPosition(reqst.x, reqst.y, reqst.roomName), {
            ignoreCreeps: true,
            costCallback: function (roomName, costMatrix) {
              return global.map.rooms[roomName].terrain || undefined;
            }
          })

          surface = new PathFinder.CostMatrix()
          for(let step of path){
            surface.set(step.x, step.y, step.direction)
          }
          roomMem.nav[key] = surface
          pos = path[0]
        } else {
          pos = room.findPath(reqst.creep.pos, new RoomPosition(reqst.x, reqst.y, reqst.roomName), {ignoreCreeps: true})[0];
        }

        if (surface) {
          let adjustedSurface = surface.clone();
          for (let obst of obstacles) {
            adjustedSurface.set(obst.x, obst.y, 255);
          }
          pos = Quest.getNextStep(adjustedSurface, reqst.creep.pos);
        }

        reqst.x = pos.x;
        reqst.y = pos.y;
      }*/

      //let terrain = Quest.getRoomMatrix(Game.rooms["W48S56"])
      //let test = FloodFill.search([{pos:{x:17,y:41,roomName:"W48S56"},g:1}],terrain)
      let terVis = new RoomVisual("W48S56");
      for (let reqst of requests) {
        terVis.circle(reqst.x, reqst.y);
      }
      /*if(global.map.rooms["W48S56"]){
        let containerNav = global.map.rooms["W48S56"].nav["1741W48S56"]
        containerNav = test
        if(!containerNav) return
        for(let i = 0; i < 50;i++){
          for(let k = 0; k < 50;k++){
            terVis.text(JSON.stringify(containerNav.get(i,k)),i,k)
          }
        }
      }*/
    }

    this.moveAsks = {};
  }

  public static getNextStep(targetPos:Pos, pos: Pos) {
    /*let bestPos = pos;
    let bestScore = 999999;
    for (let dir of Tools.DIRECTIONS) {
      const newCoords = Tools.getOffset({ x: pos.x, y: pos.y, roomName: pos.roomName }, dir);
      if (surface.get(newCoords.x, newCoords.y) < bestScore && surface.get(newCoords.x, newCoords.y) != 0) {
        bestScore = surface.get(newCoords.x, newCoords.y);
        bestPos = newCoords;
      }
    }*/

    const roomName = pos.roomName
    let roomMem = global.map.rooms[roomName]
    let room = Game.rooms[roomName]

    if(!roomMem){
      return room.findPath(new RoomPosition(pos.x, pos.y, pos.roomName), new RoomPosition(targetPos.x, targetPos.y, targetPos.roomName))[0]
    }

    let surface
    let edited = false
    let key = `${targetPos.x * 100 + targetPos.y}${targetPos.roomName}`;
    if(!roomMem.nav[key]){
      surface = new PathFinder.CostMatrix()
      edited = true
    } else{
      surface = roomMem.nav[key]
    }

    let dir = surface.get(pos.x, pos.x)
    if(dir == 0){
      this.flowFromPathfind(surface, targetPos, pos)
      edited = true
      dir = surface.get(pos.x, pos.y)
      if(dir == 0){
        console.log("pathing panic!")
        return pos
      }
    }

    let bestPos = Tools.getOffset(pos, dir)
    if(surface.get(bestPos.x, bestPos.y) != 255){
      return bestPos
    }
    //blocked by enemy or stationary creep. TODO: if no path then call exterminator
    bestPos = pos
    for(let dir of Tools.DIRECTIONS){
      let testPos = Tools.getOffset(pos, dir)
      let testDir = surface.get(testPos.x, testPos.y)
      if(testDir != 255 && testDir != 0 &&  Tools.getOffset(testPos, surface.get(testPos.x, testPos.y))){

      }
    }

    return bestPos;
  }

  private dfs(reqst:RequestMove, score = 0){
    return 0
  }

  private static flowFromPathfind(surface:CostMatrix, targetPos:Pos, originPos:Pos){

  }

  public static getRoomMatrix(room: Room, freshMatrix?: boolean): CostMatrix {
    let matrix = new PathFinder.CostMatrix();
    matrix = this.terrainify(room, matrix);
    matrix = this.structurify(room, matrix);

    let roomMem = global.map.rooms[room.name];
    if (roomMem) {
      let duplicate = true;
      for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
          if (matrix.get(x, y) != roomMem.terrain.get(x, y)) {
            duplicate = false;
            break;
          }
        }
        if (!duplicate) {
          break;
        }
      }
      if (!duplicate) {
        roomMem.terrain = matrix;
        roomMem.nav = {};
        console.log("change in room " + room.name);
      }
    }

    return matrix;
  }

  private static structurify(room: Room, matrix: CostMatrix): CostMatrix {
    let impassibleStructures: Structure[] = [];
    for (let structure of room.find(FIND_STRUCTURES)) {
      if (structure instanceof StructureRampart) {
        if (!structure.my && !structure.isPublic) {
          impassibleStructures.push(structure);
        }
      } else if (structure instanceof StructureRoad) {
        matrix.set(structure.pos.x, structure.pos.y, this.CONSTS.ROAD);
      } else if (structure instanceof StructureContainer) {
        matrix.set(structure.pos.x, structure.pos.y, this.CONSTS.CONTAINER);
      } else {
        impassibleStructures.push(structure);
      }
    }

    for (let site of room.find(FIND_MY_CONSTRUCTION_SITES)) {
      if (
        site.structureType === STRUCTURE_CONTAINER ||
        site.structureType === STRUCTURE_ROAD ||
        site.structureType === STRUCTURE_RAMPART
      ) {
        continue;
      }
      matrix.set(site.pos.x, site.pos.y, this.CONSTS.STRUCTURE);
    }

    for (let structure of impassibleStructures) {
      matrix.set(structure.pos.x, structure.pos.y, this.CONSTS.STRUCTURE);
    }

    return matrix;
  }

  private static terrainify(room: Room, matrix: CostMatrix) {
    let terrainRaw = new Room.Terrain(room.name);
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        switch (terrainRaw.get(x, y)) {
          case 0:
            matrix.set(x, y, this.CONSTS.PLAIN);
            break;
          case 1:
            matrix.set(x, y, this.CONSTS.WALL);
            break;
          case 2:
            matrix.set(x, y, this.CONSTS.SWAMP);
            break;
        }
      }
    }
    return matrix;
  }
}

export default Quest;
