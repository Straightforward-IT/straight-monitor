(async () => {
  const { expect } = require("chai");
const findFlipUserByName = require("../findFlipUserByName");

const flipUsers = [
    { vorname: "Alexander", nachname: "Bode", _id: "1" },
    { vorname: "Alexander", nachname: "Hinzky-Drews", _id: "2" },
    { vorname: "Alexander", nachname: "Pohlmann", _id: "3" },
    { vorname: "Anna", nachname: "Bajer", _id: "4" },
    { vorname: "Anjo", nachname: "Shanti", _id: "5" },
    { vorname: "Benjamin", nachname: "Liebers", _id: "6" },
    { vorname: "Dimitri", nachname: "Hepner", _id: "7" },
    { vorname: "Dominic", nachname: "Rieger", _id: "8" },
    { vorname: "Edgar", nachname: "Mrowinski", _id: "9" },
    { vorname: "Emmelie", nachname: "Niklasch", _id: "10" },
    { vorname: "Eva", nachname: "Roßbruch", _id: "11" },
    { vorname: "Falk", nachname: "Lützelberger", _id: "12" },
    { vorname: "Francesco", nachname: "Di Antonio", _id: "13" },
    { vorname: "Friedrich", nachname: "Lux", _id: "14" },
    { vorname: "Hannah", nachname: "Desczyk", _id: "15" },
    { vorname: "Jana", nachname: "Hennemann", _id: "16" },
    { vorname: "Jacqueline", nachname: "Braun", _id: "17" },
    { vorname: "Jonas", nachname: "Hohlbein", _id: "18" },
    { vorname: "Julius", nachname: "Meier", _id: "19" },
    { vorname: "Justus", nachname: "Haneberg", _id: "20" },
    { vorname: "Kim", nachname: "Chi Pham Vu", _id: "21" },
    { vorname: "Kristin", nachname: "Stäber", _id: "22" },
    { vorname: "Lina", nachname: "Yaku", _id: "23" },
    { vorname: "Linda", nachname: "Mannamplakel", _id: "24" },
    { vorname: "Lilly", nachname: "Tietjens", _id: "25" },
    { vorname: "Lukas", nachname: "Kavalisauskas", _id: "26" },
    { vorname: "Marie", nachname: "Struhs", _id: "27" },
    { vorname: "Patrick", nachname: "Reinke", _id: "28" },
    { vorname: "Paul", nachname: "Mugamba", _id: "29" },
    { vorname: "Robert", nachname: "Solbach", _id: "30" },
    { vorname: "Robin", nachname: "Schmidt", _id: "31" },
    { vorname: "Sabine", nachname: "Wendler Gutierrez", _id: "32" },
    { vorname: "Samantha", nachname: "Bonack", _id: "33" },
    { vorname: "Smilte", nachname: "Svilpaite-Schönherr", _id: "34" },
    { vorname: "Tamia", nachname: "Kandume", _id: "35" },
    { vorname: "Tony", nachname: "Seifert", _id: "36" },
    { vorname: "Yannik", nachname: "Kähler", _id: "37" },
    { vorname: "Abdul", nachname: "Iddrisu", _id: "38" },
    { vorname: "Amir", nachname: "Khalilov", _id: "39" },
    { vorname: "Bastian", nachname: "Fervers", _id: "40" },
    { vorname: "Daniela", nachname: "Reinhard", _id: "41" },
    { vorname: "Deborah", nachname: "Emouwhe", _id: "42" },
    { vorname: "Dennis", nachname: "Schröder", _id: "43" },
    { vorname: "Dieter", nachname: "Banovic", _id: "44" },
    { vorname: "Fabian", nachname: "Brusch", _id: "45" },
    { vorname: "Frank", nachname: "Pongratz", _id: "46" },
    { vorname: "Henric", nachname: "Willmann", _id: "47" },
    { vorname: "Lasse", nachname: "Hartmann", _id: "48" },
    { vorname: "Moritz", nachname: "Hube", _id: "49" },
    { vorname: "Marlon", nachname: "Eggers", _id: "50" },
    { vorname: "Maria", nachname: "Karapiperi", _id: "51" },
    { vorname: "Michael", nachname: "Herzberg", _id: "52" },
    { vorname: "Piet", nachname: "Bimberg", _id: "53" },
    { vorname: "Selen", nachname: "Sürücü", _id: "54" },
    { vorname: "Sona", nachname: "Shmavonyan", _id: "55" },
    { vorname: "Tunahan", nachname: "Öz", _id: "56" },
    { vorname: "Diego", nachname: "Fiore", _id: "57" },
    { vorname: "Juliane", nachname: "Landrock", _id: "58" },
    { vorname: "Kareem", nachname: "Wensauer", _id: "59" },
    { vorname: "Leni", nachname: "Hoff", _id: "60" },
    { vorname: "Ramona", nachname: "Hoppe", _id: "61" },
    { vorname: "Thore", nachname: "Dünnwald", _id: "62" },
  ];

describe("findFlipUserByName", () => {
  it("should find the correct user for an exact match", async () => {
    const result = await findFlipUserByName("Alexander Bode", flipUsers);
    expect(result).to.equal("1");
  });

  it("should find the correct user for a near match", async () => {
    const result = await findFlipUserByName("Alex Pohlmann", flipUsers);
    expect(result).to.equal("3");
  });

  it("should return null if no match is found", async () => {
    const result = await findFlipUserByName("Nonexistent User", flipUsers);
    expect(result).to.be.null;
  });

  it("should handle special characters in names", async () => {
    const result = await findFlipUserByName("Alexander Hinzky Drews", flipUsers);
    expect(result).to.equal("2");
  });

  it("should find a user when multiple keywords are used", async () => {
    const result = await findFlipUserByName("Emmelie Niklasch", flipUsers);
    expect(result).to.equal("10");
  });
});
})();