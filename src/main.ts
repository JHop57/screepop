/*
Telos, ᏘᎼᏗ
June 2025
screeps bot rewrite based on https://github.com/screepers/screeps-typescript-starter
reason: had enough of type errors in runtime, implement task manager type systems
*/

import { WorldAtlas } from "WorldAtlas";
import { JobBoard } from "JobBoard";
import {Tools} from "utils/Tools";
import { creepHandler } from "Foreman";
import { Prioritizer } from "Prioritizer";

declare global {
  interface Memory {
    uuid: number;
    log: any;
    worldAtlas: any;
    jobBoard: any;
    prioritizer: any;
  }

  interface Creep {
    _say: (message: string, public?: boolean) => 0|-1|-4;
  }

}
// Syntax for adding properties to `global` (ex "global.log")
declare const global: {
  log: any;
}

//monkeypatching
const _say = Creep.prototype.say;
Creep.prototype.say = function(message, sayPublic = true) {
    return _say.call(this, message, sayPublic);
};

//declare my global variables, used 'g' instead of 'global' because it's shorter and I'm lazy.
(global as any).g = {atlas: new WorldAtlas(), jobBoard: new JobBoard()};

for( let room in Game.rooms){
  g.atlas.SurveyRoom(room)
}
g.atlas.WriteMem()

let prioritizer = new Prioritizer();
for(let updateFunction of creepHandler.getUpdateFunctions()){
  prioritizer.schedule(updateFunction.func, updateFunction.name, 1, 10);
}

module.exports.loop = function (){
  prioritizer.run();
  for(let creepId in Game.creeps){
    let creep = Game.creeps[creepId];
    if(creep.spawning) continue;
    creepHandler.assignCreep(creep);
  }
  creepHandler.run();
}
