declare module "pet-pet-gif" {
  function petpet(avatarURL: string, options?: { resolution?: number, delay?: number, backgroundColor?: string }): Promise<Buffer>
  export = petpet
}