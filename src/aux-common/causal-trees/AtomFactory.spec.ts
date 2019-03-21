import { AtomFactory } from "./AtomFactory";
import { AtomOp, AtomId, atomId, atom } from "./Atom";
import { site } from './SiteIdInfo';

class Op implements AtomOp {
    type: number;
}

describe('AtomFactory', () => {
    it('should maintain the current lamport time', () => {
        const factory = new AtomFactory(site(1), 0);

        // Got event from remote
        const a1 = atom(atomId(2, 1), atomId(1, 0), new Op());
        factory.updateTime(a1);

        expect(factory.time).toBe(2);

        const a2 = atom(atomId(2, 2), atomId(1, 0), new Op());
        factory.updateTime(a2);

        expect(factory.time).toBe(3);

        // We got two concurrent events
        const a3 = atom(atomId(3, 2), atomId(1, 0), new Op());
        factory.updateTime(a3);
        expect(factory.time).toBe(4);

        // We got new event from current site
        const a4 = atom(atomId(1, 7), atomId(1, 0), new Op());
        factory.updateTime(a4);

        // Doesn't increment time to atom.time + 1 because it was a local event
        expect(factory.time).toBe(7);
    });

    it('should increment the time after creating events', () => {
        const factory = new AtomFactory(site(1), 0);

        const op = new Op();
        const atom = factory.create(op, null);

        expect(atom.id.site).toBe(1);
        expect(atom.id.timestamp).toBe(1);
        expect(atom.id.priority).toBe(0);
        expect(atom.value).toBe(op);
        expect(factory.time).toBe(1);
    });

    it('should create atoms with the given cause', () => {
        const factory = new AtomFactory(site(1), 0);

        const op = new Op();
        const root = factory.create(op, null);

        const op2 = new Op();
        const atom = factory.create(op2, root);

        expect(atom.id.site).toBe(1);
        expect(atom.id.timestamp).toBe(2);
        expect(atom.id.priority).toBe(0);
        expect(atom.cause).toBe(root.id);
        expect(atom.value).toBe(op2);
        expect(factory.time).toBe(2);
    });

    it('should create atoms with the given cause ID', () => {
        const factory = new AtomFactory(site(1), 0);

        const a1 = atom(atomId(2, 1), atomId(1, 0), new Op());
        factory.updateTime(a1);

        const op2 = new Op();
        const a2 = factory.create(op2, atomId(2, 1));

        expect(a2.id.site).toBe(1);
        expect(a2.id.timestamp).toBe(3);
        expect(a2.id.priority).toBe(0);
        expect(a2.cause).toEqual(atomId(2, 1));
        expect(a2.value).toBe(op2);
        expect(factory.time).toBe(3);
    });
});