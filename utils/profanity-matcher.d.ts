declare module "profanity-matcher" {
  class profanityMatcher {
    constructor()
    badwords: string[]
    scan(text: string, done?: boolean): string[]
    add_word(word: string): boolean
    remove_word(word: string): boolean
    save_words(badwords: string[]): boolean
  }
  export = profanityMatcher
}

