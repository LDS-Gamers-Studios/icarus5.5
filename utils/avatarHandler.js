fs = require("node:fs");
const avatarHandler = {
  sendAvatars:{},
  load:function() {
      const avatarsFolderSubfolderNames = fs.readdirSync("./data/avatars");
      for (const subfolderNum in avatarsFolderSubfolderNames) {
        const subfolderName = avatarsFolderSubfolderNames[subfolderNum];
        if (!subfolderName.startsWith("-") && subfolderName.charAt(subfolderName.lastIndexOf(".")-1)!="-") {
          avatarHandler.sendAvatars[subfolderName] = {};
          const avatarSubfolderFileNames = fs.readdirSync("./data/avatars/"+subfolderName);
          for (const fileNum in avatarSubfolderFileNames) {
            const file = avatarSubfolderFileNames[fileNum];
            // console.log("hi")
            // console.log("-"+file+"+")
            // console.log(file.charAt(file.lastIndexOf(".")-1))
            // console.log(!file.startsWith("-"))
            // console.log(file.charAt(file.lastIndexOf(".")-1)!="-")
            // console.log(!file.startsWith("-") && file.charAt(file.lastIndexOf(".")-1)!="-")
            if (!file.startsWith("-") && file.charAt(file.lastIndexOf(".")-1)!="-") {
              // console.log("hijo")
              avatar = new avatarHandler.fullAvatar("./data/avatars/"+subfolderName+"/"+file);
              avatarHandler.sendAvatars[subfolderName][avatar.id] = avatar;
              // console.log("addedAvatar:"+avatar)
            }
          }
        }
      }
      //console.log(avatarHandler.sendAvatars);
  },
  fullAvatar:class{
    id;
    pfp;
    nick;
    possibleFileName;
    constructor(filePath) {
      // console.log("1:"+filePath)
      const pathsteps = filePath.split(/[/\\]/);
      this.constructer(filePath,pathsteps[pathsteps.length-1])
    }
    constructer(pfp,idOrFileName,nick) {
      if (nick) {
        const id = idOrFileName
        // console.log("3:"+pfp+"*"+id+"*"+nick)
        this.pfp=pfp;
        this.id=id;
        this.nick=nick;
        this.possibleFileName=id+":"+nick+".jpg";
      } else {
        const filename = idOrFileName
        // console.log("2:"+filename+"*"+pfp)
        let parsing = filename.split(".");
        parsing[parsing.length-1]="";
        parsing = parsing.join("");
        parsing = parsing.split(":");
        const id = parsing[0];
        const nick = parsing[1]?parsing[1]:parsing[0];
        this.constructer(pfp,id,nick)
        
      }
    }
  }
}
avatarHandler.load();
module.exports = avatarHandler;