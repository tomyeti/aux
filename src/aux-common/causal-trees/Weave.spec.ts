import { Weave, WeaveReference, reference } from "./Weave";
import { Atom, AtomId, AtomOp, atom, atomId } from "./Atom";


describe('Weave', () => {

    class Op implements AtomOp {
        type: number;

        constructor(type?: number) {
            this.type = type;
        }
    }

    describe('insert()', () => {
        it('should return references', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            expect(ref1.atom.id.site).toBe(1);
            expect(ref2.atom.id.site).toBe(1);
            expect(ref3.atom.id.site).toBe(2);

            const atoms = weave.atoms.map(a => a.atom);
            expect(atoms).toEqual([
                a1, a3, a2
            ]);
        });

        it('should order atoms based on their timestamp', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            // Later atoms should be sorted before earlier ones
            // Therefore when adding an atom with time 2 it should be sorted after atom at time 3.
            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            expect(ref1.atom.id.site).toBe(1);
            expect(ref2.atom.id.site).toBe(1);
            expect(ref3.atom.id.site).toBe(2);

            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1, a3, a2
            ]);
        });

        it('should order atoms based on their site ID if timestamp is equal', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            
            const a3 = atom(atomId(2, 2), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            // Lower Site IDs should be sorted before higher ones
            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            expect(ref1.atom.id.site).toBe(1);
            expect(ref2.atom.id.site).toBe(1);
            expect(ref3.atom.id.site).toBe(2);

            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1, a2, a3
            ]);
        });

        it('should consider priority for sorting', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a3 = atom(atomId(2, 4), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);

            const a4 = atom(atomId(3, 2, 1), atomId(1, 1), new Op());
            const ref4 = weave.insert(a4);

            const a2 = atom(atomId(1, 3), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);

            expect(ref1.atom.id.site).toBe(1);
            expect(ref2.atom.id.site).toBe(1);
            expect(ref3.atom.id.site).toBe(2);
            expect(ref4.atom.id.site).toBe(3);

            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1, a4, a3, a2
            ]);
        });

        it('should handle deeply nested atoms', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(2, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);

            const a3 = atom(atomId(2, 3), atomId(2, 2), new Op());
            const ref3 = weave.insert(a3);

            const a4 = atom(atomId(1, 4), atomId(2, 3), new Op());
            const ref4 = weave.insert(a4);

            const a5 = atom(atomId(1, 5), atomId(1, 1), new Op());
            const ref5 = weave.insert(a5);

            expect(ref1.atom.id.site).toBe(1);
            expect(ref2.atom.id.site).toBe(2);
            expect(ref3.atom.id.site).toBe(2);
            expect(ref4.atom.id.site).toBe(1);
            expect(ref5.atom.id.site).toBe(1);

            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1, 
                a5, 
                a2, a3, a4
            ]);
        });

        it('should only allow a single root atom', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const a2 = atom(atomId(2, 1), null, new Op());
            const ref1 = weave.insert(a1);
            const ref2 = weave.insert(a1);
            const ref3 = weave.insert(a2);

            expect(ref1).toBe(ref2);
            expect(ref1).toBe(ref3);
            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1,
            ]);
        });

        it('should handle adding the same atom twice as long as its not the root', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref1 = weave.insert(a1);
            const ref2 = weave.insert(a2);
            const ref3 = weave.insert(a2);

            expect(ref2).toBe(ref3);
            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1,
                a2
            ]);
        });

        it('should discard atoms that dont have their parent in the weave', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const a2 = atom(atomId(1, 2), atomId(2, 10), new Op());
            const ref1 = weave.insert(a1);
            const ref2 = weave.insert(a2);

            expect(ref2).toBe(null);
            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1,
            ]);
        });

        it('should not allow inserting atoms with a cause as the root', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), atomId(1, 2), new Op());
            const ref1 = weave.insert(a1);

            expect(ref1).toBe(null);
            expect(weave.atoms.map(a => a.atom)).toEqual([]);
        });

        it('should insert atoms that are older than the most recent atom from the same site into the right timestamp', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 10), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);

            const a3 = atom(atomId(1, 8), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);

            expect(ref3).not.toBe(null);
            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1,
                a2,
                a3
            ]);
        });
    });

    describe('remove()', () => {
        it('should return false when given null', () => {
            let weave = new Weave();
            expect(weave.remove(null)).toBe(false);
        });

        it('should return false when given a reference thats not in the weave', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const ref3 = reference(a3);
            
            expect(weave.remove(ref3)).toBe(false);
        });

        it('should remove the given reference from the weave', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            expect(weave.remove(ref3)).toBe(true);

            const atoms = weave.atoms.map(a => a.atom);
            expect(atoms).toEqual([
                a1, a2
            ]);
        });

        it('should remove all the children of the given reference when it is at the end of the weave', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            expect(weave.remove(ref1)).toBe(true);

            const atoms = weave.atoms.map(a => a.atom);
            expect(atoms).toEqual([]);

            const site1 = weave.getSite(1);
            expect(site1[1]).toBe(undefined);
            expect(site1[2]).toBe(undefined);
            expect(site1.length).toBe(3);
        });

        it('should remove all the children of the given reference when it is in the middle of the weave', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            const a3 = atom(atomId(2, 3), atomId(1, 2), new Op());
            const ref3 = weave.insert(a3);

            const a4 = atom(atomId(2, 4), atomId(1, 2), new Op());
            const ref4 = weave.insert(a4);

            const a5 = atom(atomId(2, 5), atomId(1, 1), new Op());
            const ref5 = weave.insert(a5);
            
            expect(weave.remove(ref2)).toBe(true);

            const atoms = weave.atoms.map(a => a.atom);
            expect(atoms).toEqual([
                a1, a5
            ]);

            const site1 = weave.getSite(1);
            expect(site1[1]).toBe(ref1);
            expect(site1[2]).toBe(undefined);
            expect(site1.length).toBe(3);

            const site2 = weave.getSite(2);
            expect(site2[3]).toBe(undefined);
            expect(site2[4]).toBe(undefined);
            expect(site2[5]).toBe(ref5);
            expect(site2.length).toBe(6);
        });
    });

    describe('removeBefore()', () => {
        it('should return false if given null', () => {
            let weave = new Weave();
            expect(weave.removeBefore(null)).toBe(false);
            expect(weave.removeBefore(undefined)).toBe(false);
        });

        it('should return false if given an atom that is not in the weave', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);

            const a4 = atom(atomId(2, 4), atomId(1, 1), new Op());
            const ref4 = reference(a4);
            
            expect(weave.removeBefore(ref4)).toBe(false);
        });

        it('should remove all of the sibling references that occurred before the given reference', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);

            const a4 = atom(atomId(2, 4), atomId(1, 1), new Op());
            const ref4 = weave.insert(a4);
            
            expect(weave.removeBefore(ref4)).toBe(true);

            const atoms = weave.atoms.map(a => a.atom);
            expect(atoms).toEqual([
                a1, a4
            ]);
        });

        it('should not remove anything if there are no sibling references', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);

            const a3 = atom(atomId(1, 3), atomId(1, 2), new Op());
            const ref3 = weave.insert(a3);
            
            expect(weave.removeBefore(ref2)).toBe(true);

            const atoms = weave.atoms.map(a => a.atom);
            expect(atoms).toEqual([
                a1, a2, a3
            ]);
        });

        it('should preserve its own children', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);

            const a3 = atom(atomId(1, 3), atomId(1, 2), new Op());
            const ref3 = weave.insert(a3);

            const a4 = atom(atomId(1, 4), atomId(1, 1), new Op());
            const ref4 = weave.insert(a4);

            const a5 = atom(atomId(1, 5), atomId(1, 4), new Op());
            const ref5 = weave.insert(a5);
            
            expect(weave.removeBefore(ref4)).toBe(true);

            const atoms = weave.atoms.map(a => a.atom);
            expect(atoms).toEqual([
                a1, a4, a5
            ]);
        });

        it('should work for deep nesting', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);

            const a3 = atom(atomId(1, 3), atomId(1, 2), new Op());
            const ref3 = weave.insert(a3);

            const a4 = atom(atomId(1, 4), atomId(1, 3), new Op());
            const ref4 = weave.insert(a4);

            const a5 = atom(atomId(1, 5), atomId(1, 4), new Op());
            const ref5 = weave.insert(a5);

            const a6 = atom(atomId(1, 6), atomId(1, 4), new Op());
            const ref6 = weave.insert(a6);

            const a7 = atom(atomId(1, 7), atomId(1, 3), new Op());
            const ref7 = weave.insert(a7);
            
            const a8 = atom(atomId(1, 8), atomId(1, 2), new Op());
            const ref8 = weave.insert(a8);

            const a9 = atom(atomId(1, 9), atomId(1, 1), new Op());
            const ref9 = weave.insert(a9);

            expect(weave.removeBefore(ref7)).toBe(true);

            const atoms = weave.atoms.map(a => a.atom);
            expect(atoms).toEqual([
                a1, a9, a2, a8, a3, a7
            ]);
        });
    });

    describe('getSite()', () => {
        it('should return atoms in order of their timestamps', () => {
            const a1 = atom(atomId(1, 1), null, new Op());
            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const a3 = atom(atomId(7, 3), atomId(1, 1), new Op());
            const a4 = atom(atomId(1, 4), atomId(1, 2), new Op());
            const a5 = atom(atomId(2, 5), atomId(1, 2), new Op());
            const a6 = atom(atomId(1, 6), atomId(1, 2), new Op());

            let weave = new Weave();

            const a1Ref = weave.insert(a1);
            const a3Ref = weave.insert(a3);
            const a2Ref = weave.insert(a2);
            const a4Ref = weave.insert(a4);
            const a5Ref = weave.insert(a5);
            const a6Ref = weave.insert(a6);

            const site1 = weave.getSite(1);
            const site2 = weave.getSite(2);
            const site7 = weave.getSite(7);

            expect(site1[1]).toEqual(a1Ref);
            expect(site1[2]).toEqual(a2Ref);
            expect(site1[4]).toEqual(a4Ref);
            expect(site1[6]).toEqual(a6Ref);
            expect(site1.length).toEqual(7);

            expect(site2[5]).toEqual(a5Ref);
            expect(site2.length).toEqual(6);

            expect(site7[3]).toEqual(a3Ref);
            expect(site7.length).toEqual(4);
        });
    });

    describe('getAtomSize()', () => {
        it('should return undefined if the ID is not in the weave', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());

            expect(weave.getAtomSize(a1.id)).toBeUndefined();
        });

        it('should return 1 when the reference has no children', () => {
            let weave = new Weave();

            const a1 = weave.insert(atom(atomId(1, 1), null, new Op()));

            expect(weave.getAtomSize(a1.atom.id)).toBe(1);
        });
        
        it('should return 2 when the reference has a single child', () => {
            let weave = new Weave();

            const a1 = weave.insert(atom(atomId(1, 1), null, new Op()));
            const a2 = weave.insert(atom(atomId(1, 2), atomId(1, 1), new Op()));

            expect(weave.getAtomSize(a1.atom.id)).toBe(2);
            expect(weave.getAtomSize(a2.atom.id)).toBe(1);
        });

        it('should return the total width that the reference has', () => {
            let weave = new Weave();

            const a1 = weave.insert(atom(atomId(1, 1), null, new Op()));
            const a2 = weave.insert(atom(atomId(1, 2), atomId(1, 1), new Op()));
            const a3 = weave.insert(atom(atomId(1, 3), atomId(1, 1), new Op()));
            const a4 = weave.insert(atom(atomId(1, 4), atomId(1, 2), new Op()));
            const a5 = weave.insert(atom(atomId(1, 5), atomId(1, 2), new Op()));

            expect(weave.getAtomSize(a1.atom.id)).toBe(5);
            expect(weave.getAtomSize(a2.atom.id)).toBe(3);
            expect(weave.getAtomSize(a3.atom.id)).toBe(1);
            expect(weave.getAtomSize(a4.atom.id)).toBe(1);
            expect(weave.getAtomSize(a5.atom.id)).toBe(1);
        });

        it('should update after deletes', () => {
            let weave = new Weave();

            const a1 = weave.insert(atom(atomId(1, 1), null, new Op()));
            const a2 = weave.insert(atom(atomId(1, 2), atomId(1, 1), new Op()));

            weave.remove(a2);

            expect(weave.getAtomSize(a2.atom.id)).toBeUndefined();
            expect(weave.getAtomSize(a1.atom.id)).toBe(1);
        });

        it('should update after imports', () => {
            let original = new Weave();

            const a1 = original.insert(atom(atomId(1, 1), null, new Op()));
            const a2 = original.insert(atom(atomId(1, 2), atomId(1, 1), new Op()));
            const a3 = original.insert(atom(atomId(1, 3), atomId(1, 1), new Op()));
            const a4 = original.insert(atom(atomId(1, 4), atomId(1, 2), new Op()));
            const a5 = original.insert(atom(atomId(1, 5), atomId(1, 2), new Op()));

            let weave = new Weave();
            weave.import(original.atoms);

            expect(weave.getAtomSize(a1.atom.id)).toBe(5);
            expect(weave.getAtomSize(a2.atom.id)).toBe(3);
            expect(weave.getAtomSize(a3.atom.id)).toBe(1);
            expect(weave.getAtomSize(a4.atom.id)).toBe(1);
            expect(weave.getAtomSize(a5.atom.id)).toBe(1);
        });
    });

    describe('getVersion()', () => {
        it('should return an array with the latest timestamps from each site', () => {
            const a1 = atom(atomId(1, 1), null, new Op());
            const a2 = atom(atomId(9, 2), atomId(1, 1), new Op());
            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const a4 = atom(atomId(1, 4), atomId(2, 3), new Op());

            let first = new Weave();
            let second = new Weave();
            first.insertMany(a1, a2, a3, a4);
            second.insertMany(a1, a3, a2, a4);

            const firstVersion = first.getVersion();
            const secondVersion = second.getVersion();

            expect(firstVersion.sites).toEqual({
                1: 4,
                2: 3,
                9: 2
            });
            expect(firstVersion.sites).toEqual(secondVersion.sites);
        });

        it('should return the current hash', () => {
            const a1 = atom(atomId(1, 1), null, new Op());
            const a2 = atom(atomId(9, 2), atomId(1, 1), new Op());
            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const a4 = atom(atomId(1, 4), atomId(2, 3), new Op());

            let first = new Weave();
            let second = new Weave();
            first.insertMany(a1, a2, a3, a4);
            second.insertMany(a1, a3, a2, a4);

            const firstVersion = first.getVersion();
            const secondVersion = second.getVersion();

            // We're using the actual hash values to ensure that they never change
            // without us knowing.
            expect(firstVersion.hash).toEqual('cc490c6af0abd06bbef189f079c1d9167e32c63f7bb4a966201f730524324563');
            expect(firstVersion.hash).toEqual(secondVersion.hash);
        });

        it('should return the hash for an empty weave', () => {
            let first = new Weave();
            let second = new Weave();

            const firstVersion = first.getVersion();
            const secondVersion = second.getVersion();

            expect(firstVersion.hash).toEqual('4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945');
            expect(firstVersion.hash).toEqual(secondVersion.hash);
        });

        it('should have different hash values for different weaves', () => {
            const a1 = atom(atomId(1, 1), null, new Op());
            const a2 = atom(atomId(9, 2), atomId(1, 1), new Op());
            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const a4 = atom(atomId(1, 4), atomId(1, 2), new Op());

            let first = new Weave();
            let second = new Weave();
            first.insertMany(a1, a2, a3, a4);
            second.insertMany(a1, a2, a4);

            const firstVersion = first.getVersion();
            const secondVersion = second.getVersion();

            expect(firstVersion.hash).not.toEqual(secondVersion.hash);
        });
    });

    describe('import()', () => {
        it('should prevent importing atoms that dont have causes', () => {
            let weave = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
            const child3 = atom<Op>(atomId(1, 2), child1.id, new Op());
            
            weave.insertMany(root, child1, child3);
            
            const child2 = atom<Op>(atomId(2, 2), atomId(2, 196), new Op());

            const ref = reference(child2);

            let newWeave = new Weave<Op>();
            newWeave.import([
                ...weave.atoms,
                ref
            ]);

            expect(newWeave.atoms).toEqual(weave.atoms);
        });

        it('should add the given list of atoms to the list verbatim', () => {
            let weave = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
            const child3 = atom<Op>(atomId(1, 3), child1.id, new Op());
            const child2 = atom<Op>(atomId(1, 2), root.id, new Op());

            weave.insertMany(root, child1, child2, child3);

            const refs = weave.atoms;

            let newWeave = new Weave<Op>();
            const newAtoms = newWeave.import(refs);

            expect(newWeave.atoms.map(a => a.atom)).toEqual([
                root,
                child2,
                child1,
                child3,
            ]);

            const site = newWeave.getSite(1);

            expect(site[0].atom).toBe(root);
            expect(site[1].atom).toBe(child1);
            expect(site[2].atom).toBe(child2);
            expect(site[3].atom).toBe(child3);

            expect(newAtoms.map(a => a.atom)).toEqual([
                root,
                child2,
                child1,
                child3
            ]);
        });

        it('should be able to merge another weave into itself', () => {
            let first = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
            const child2 = atom<Op>(atomId(1, 2), root.id, new Op());
            const child3 = atom<Op>(atomId(1, 3), child1.id, new Op());
            const child6 = atom<Op>(atomId(1, 6), child2.id, new Op());

            first.insertMany(root, child1, child2, child3, child6);

            let second = new Weave<Op>();

            const child4 = atom<Op>(atomId(2, 4), root.id, new Op());
            const child5 = atom<Op>(atomId(2, 5), child1.id, new Op());

            second.insertMany(root, child1, child2, child3, child4, child5);

            const firstRefs = first.atoms;
            const secondRefs = second.atoms;

            let newWeave = new Weave<Op>();
            const importedFromFirst = newWeave.import(firstRefs);
            const importedFromSecond = newWeave.import(secondRefs);

            const atoms = newWeave.atoms.map(a => a.atom);
            expect(atoms[0]).toEqual(root);
            expect(atoms[1]).toEqual(child4);
            expect(atoms[2]).toEqual(child2);
            expect(atoms[3]).toEqual(child6);
            expect(atoms[4]).toEqual(child1);
            expect(atoms[5]).toEqual(child5);
            expect(atoms[6]).toEqual(child3);
            expect(atoms.length).toBe(7);

            expect(importedFromFirst.map(a => a.atom)).toEqual([
                root,
                child2,
                child6,
                child1,
                child3
            ]);

            expect(importedFromSecond.map(a => a.atom)).toEqual([
                child4,
                child5
            ]);
        });

        it('should be able to merge a partial weave into itself', () => {
            let first = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
            const child2 = atom<Op>(atomId(1, 2), root.id, new Op());
            const child3 = atom<Op>(atomId(1, 3), child1.id, new Op());
            const child6 = atom<Op>(atomId(1, 6), child2.id, new Op());

            first.insertMany(root, child1, child2, child3, child6);

            let second = new Weave<Op>();

            const child4 = atom<Op>(atomId(2, 4), root.id, new Op());
            const child5 = atom<Op>(atomId(2, 5), child1.id, new Op());

            second.insertMany(root, child1, child4, child5);

            const firstRefs = first.atoms;
            const secondRefs = second.atoms;

            let newWeave = new Weave<Op>();
            newWeave.import(firstRefs);

            // Note that the partial weave must contain a complete causal chain.
            // That is, every parent node to the leafs
            newWeave.import(secondRefs);

            const atoms = newWeave.atoms.map(a => a.atom);
            expect(atoms[0]).toEqual(root);
            expect(atoms[1]).toEqual(child4);
            expect(atoms[2]).toEqual(child2);
            expect(atoms[3]).toEqual(child6);
            expect(atoms[4]).toEqual(child1);
            expect(atoms[5]).toEqual(child5);
            expect(atoms[6]).toEqual(child3);
            expect(atoms.length).toBe(7);
        });

        it('should be able to merge a deep weave into itself', () => {
            let first = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
            const child2 = atom<Op>(atomId(1, 2), root.id, new Op());
            const child3 = atom<Op>(atomId(1, 3), child1.id, new Op());
            const child6 = atom<Op>(atomId(1, 6), child2.id, new Op());
            const child9 = atom<Op>(atomId(1, 7), child6.id, new Op());

            first.insertMany(root, child1, child2, child3, child6, child9);

            let second = new Weave<Op>();

            const child4 = atom<Op>(atomId(2, 4), root.id, new Op());
            const child5 = atom<Op>(atomId(2, 5), child1.id, new Op());
            const child7 = atom<Op>(atomId(2, 6), child5.id, new Op());
            const child8 = atom<Op>(atomId(2, 7), child7.id, new Op());

            second.insertMany(root, child1, child4, child5, child7, child8);

            const firstRefs = first.atoms;
            const secondRefs = second.atoms;

            let newWeave = new Weave<Op>();
            newWeave.import(firstRefs);

            // Note that the partial weave must contain a complete causal chain.
            // That is, every parent node to the leafs
            newWeave.import(secondRefs);

            const atoms = newWeave.atoms.map(a => a.atom);
            expect(atoms[0]).toEqual(root);
            expect(atoms[1]).toEqual(child4);
            expect(atoms[2]).toEqual(child2);
            expect(atoms[3]).toEqual(child6);
            expect(atoms[4]).toEqual(child9);
            expect(atoms[5]).toEqual(child1);
            expect(atoms[6]).toEqual(child5);
            expect(atoms[7]).toEqual(child7);
            expect(atoms[8]).toEqual(child8);
            expect(atoms[9]).toEqual(child3);
            expect(atoms.length).toBe(10);
        });

        describe('yarn', () => {

            it('should keep the yarn updated', () => {
                let first = new Weave<Op>();

                const root = atom<Op>(atomId(1, 0), null, new Op());
                const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
                const child2 = atom<Op>(atomId(1, 2), root.id, new Op());
                const child3 = atom<Op>(atomId(1, 3), child1.id, new Op());
                const child6 = atom<Op>(atomId(1, 6), child2.id, new Op());
                const child9 = atom<Op>(atomId(1, 7), child6.id, new Op());

                first.insertMany(root, child1, child2, child3, child6, child9);

                let second = new Weave<Op>();

                const child4 = atom<Op>(atomId(2, 4), root.id, new Op());
                const child5 = atom<Op>(atomId(2, 5), child1.id, new Op());
                const child7 = atom<Op>(atomId(2, 6), child5.id, new Op());
                const child8 = atom<Op>(atomId(2, 7), child7.id, new Op());

                second.insertMany(root, child1, child4, child5, child7, child8);

                const firstRefs = first.atoms;
                const secondRefs = second.atoms;

                let newWeave = new Weave<Op>();
                newWeave.import(firstRefs);

                // Note that the partial weave must contain a complete causal chain.
                // That is, every parent node to the leafs
                newWeave.import(secondRefs);

                const atoms = newWeave.atoms.map(a => a.atom);

                const site1 = newWeave.getSite(1);
                expect(site1[0].atom).toEqual(root);
                expect(site1[1].atom).toEqual(child1);
                expect(site1[2].atom).toEqual(child2);
                expect(site1[3].atom).toEqual(child3);
                expect(site1[6].atom).toEqual(child6);
                expect(site1[7].atom).toEqual(child9);
                expect(site1.length).toBe(8);

                const site2 = newWeave.getSite(2);
                expect(site2[4].atom).toEqual(child4);
                expect(site2[5].atom).toEqual(child5);
                expect(site2[6].atom).toEqual(child7);
                expect(site2[7].atom).toEqual(child8);
                expect(site2.length).toBe(8);
            });

            it('should handle atoms getting inserted in weird orders', () => {
                let first = new Weave<Op>();

                const root = atom<Op>(atomId(1, 0), null, new Op());
                const child1 = atom<Op>(atomId(1, 1), root.id, new Op());

                first.insertMany(root, child1);

                let second = new Weave<Op>();

                const child4 = atom<Op>(atomId(2, 4), root.id, new Op());
                second.insertMany(root, child1, child4);

                let third = new Weave<Op>();

                const child5 = atom<Op>(atomId(3, 5), root.id, new Op());
                third.insertMany(root, child1, child4, child5);

                const firstRefs = first.atoms;
                const secondRefs = second.atoms;

                let newWeave = new Weave<Op>();
                newWeave.import(firstRefs);
                newWeave.import(third.atoms);

                const atoms = newWeave.atoms.map(a => a.atom);

                const site1 = newWeave.getSite(1);
                expect(site1[0].atom).toEqual(root);
                expect(site1[1].atom).toEqual(child1);
                expect(site1.length).toBe(2);

                const site2 = newWeave.getSite(2);
                expect(site2[4].atom).toEqual(child4);
                expect(site2.length).toBe(5);

                const site3 = newWeave.getSite(3);
                expect(site3[5].atom).toEqual(child5);
                expect(site3.length).toBe(6);
            });
        });

        it('should reject all children when the parent checksum doesnt match', () => {
            let first = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());

            const root2 = atom<Op>(atomId(1, 0), null, new Op(1));
            const child3 = atom<Op>(atomId(2, 2), root.id, new Op());

            first.insertMany(root, child1);

            let second = new Weave<Op>();
            second.insertMany(root2, child1, child3);

            expect(first.atoms[0].atom.checksum).not.toEqual(second.atoms[0].atom.checksum);
            expect(first.atoms[1].atom.checksum).toEqual(second.atoms[2].atom.checksum);

            const firstRefs = first.atoms;
            const secondRefs = second.atoms;

            let newWeave = new Weave<Op>();
            newWeave.import(firstRefs);

            // Note that the partial weave must contain a complete causal chain.
            // That is, every parent node to the leafs
            newWeave.import(secondRefs);

            const atoms = newWeave.atoms.map(a => a.atom);

            expect(atoms.length).toBe(2);
            expect(atoms[0]).toEqual(root);
            expect(atoms[1]).toEqual(child1);

            const site1 = newWeave.getSite(1);
            expect(site1[0].atom).toEqual(root);
            expect(site1[1].atom).toEqual(child1);
            expect(site1.length).toBe(2);

            const site2 = newWeave.getSite(2);
            expect(site2.length).toBe(0);
        });
    });

    describe('referenceChain()', () => {
        it('should the given reference if it is the root', () => {
            let weave = new Weave<Op>();

            const root = weave.insert(atom(atomId(1, 0), null, new Op()));
            const chain = weave.referenceChain(root);

            expect(chain).toEqual([
                root
            ]);
        });
        it('should return all the ancestors of the given reference', () => {
            let weave = new Weave<Op>();

            const root = weave.insert(atom(atomId(1, 0), null, new Op()));
            const child = weave.insert(atom(atomId(1, 1), atomId(1, 0), new Op()));
            const sibling = weave.insert(atom(atomId(1, 4), atomId(1, 0), new Op()));
            const grandChild = weave.insert(atom(atomId(1, 2), atomId(1, 1), new Op()));
            const grandSibling = weave.insert(atom(atomId(1, 5), atomId(1, 1), new Op()));
            const greatGrandChild = weave.insert(atom(atomId(1, 3), atomId(1, 2), new Op()));
            const greatGrandSibling = weave.insert(atom(atomId(1, 6), atomId(1, 2), new Op()));

            const chain = weave.referenceChain(greatGrandChild);

            expect(chain).toEqual([
                greatGrandChild,
                grandChild,
                child,
                root
            ]);
        });
    });

});