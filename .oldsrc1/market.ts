/**
 * The (more-or-less accurate) inverse of {@link Game.market.calcTransactionCost}.
 *
 * Returns how many resources the given energy would allow to be transferred.
 *
 * provided by Traxus from the Screeps discord
 */
export function calcTransationAmount(
    energy: number,
    roomName1: string,
    roomName2: string,
) {
    const linearDistanceBetweenRooms = Game.map.getRoomLinearDistance(roomName1, roomName2, true);
    const div = 1 - Math.exp(-linearDistanceBetweenRooms / 30);
    let amount = energy / div;
    amount -= linearDistanceBetweenRooms * Math.ceil(div);
    return Math.floor(amount);
}
