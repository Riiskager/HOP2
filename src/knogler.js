//======================================================//
//         PUNKTER FRA MEDIAPIPE POSER DIMSEN           //
//      BRUGT FOR AT DEFINERE START OG ENDPOINTS        //
//======================================================//


export const knogler ={
//Armene
//venstre over + underarm
loarm: {from: 11, to: 13},
luarm: {from: 13, to: 15},
//højre over + underarm
roarm: {from: 12, to: 14},
ruarm: {from: 14, to: 16},

//Ben
loben: {from: 23, to: 25},
luben: {from: 25, to: 27},
roben: {from: 24, to: 26},
ruben: {from: 26, to: 28},


}

export const points = {
//hænder
lhand: 15,
rhand: 16,

//kan du regne ud hvad det her er så?
hoved: 0,


//overkrop
shoulderLeft: 11,
shoulderRight: 12,
hipLeft: 23,
hipRight: 24,
}
