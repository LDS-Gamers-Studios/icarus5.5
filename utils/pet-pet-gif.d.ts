type PetPetOptions = {
  resolution?: number,
  delay?: number,
  backgroundColor?: string
}

declare module "pet-pet-gif" {
  function petpet(avatarURL: string, options?: PetPetOptions): Promise<Buffer>
  export = petpet
}